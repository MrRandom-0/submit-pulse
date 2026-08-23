/**
 * Submit Pulse — Public Form Ingestion Service
 *
 * Cloudflare Workers + Hono edge service.
 *
 * Hot path: POST /v1/forms/:publicFormId/submissions
 *
 * Pipeline stages (each in src/pipeline/):
 *   1. request-size     — enforce body size limit before buffering
 *   2. form-lookup      — resolve public form ID to a form row
 *   3. rate-limit       — per-IP, per-form limits
 *   4. origin-evaluation — allow/deny based on form_domains
 *   5. schema-validation — Zod-based field validation (server-side, always)
 *   6. captcha          — Turnstile server-side token verification
 *   7. spam-rules       — synchronous inline spam signals
 *   8. file-validation  — magic-byte checks, extension allowlist
 *   9. persistence      — write to D1 with idempotency
 *  10. enqueue          — publish to Cloudflare Queue for async work
 *
 * NOTE: The following are NEVER performed inline on this hot path.
 * They are handled by the async queue consumer worker:
 *   - Email notifications and autoresponders
 *   - Webhook delivery to integrations
 *   - AI-powered spam analysis
 *   - File antivirus scanning
 *   - Drift detection
 *   - Analytics counter updates
 */

import { Hono } from "hono";
import { brand } from "@submitpulse/config/brand";
import { InMemoryRateLimiter } from "@submitpulse/security/rate-limit";
import { TurnstileVerifier, DevBypassCaptchaVerifier } from "@submitpulse/security/captcha";

import type { Env, ContextVars } from "./types.js";
import { Errors } from "./response.js";
import { DevFormRepository } from "./repository/dev-form-repository.js";
import { D1FormRepository } from "./repository/d1-form-repository.js";

import { readBodyWithSizeGuard } from "./pipeline/request-size.js";
import { lookupForm } from "./pipeline/form-lookup.js";
import { checkRateLimits } from "./pipeline/rate-limit.js";
import { evaluateRequestOrigin } from "./pipeline/origin-evaluation.js";
import { parseBody, runSchemaValidation } from "./pipeline/schema-validation.js";
import { verifyCaptcha } from "./pipeline/captcha.js";
import { evaluateSpam, type SpamRule } from "./pipeline/spam-rules.js";
import { validateUploadedFiles } from "./pipeline/file-validation.js";
import { persistSubmission } from "./pipeline/persistence.js";
import { enqueueSubmission } from "./pipeline/enqueue.js";

// ---------------------------------------------------------------------------
// Hono app
// ---------------------------------------------------------------------------

const app = new Hono<{ Bindings: Env; Variables: ContextVars }>();

// ---------------------------------------------------------------------------
// Middleware: request ID + dependency wiring
// ---------------------------------------------------------------------------

app.use("*", async (c, next) => {
  const requestId = crypto.randomUUID();
  c.set("requestId", requestId);

  // Resolve client IP from Cloudflare headers.
  const ip =
    c.req.header("cf-connecting-ip") ??
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  c.set("clientIp", ip);

  // Wire rate limiter — Upstash in prod, InMemory in dev.
  // INCOMPLETE: swap InMemoryRateLimiter for UpstashRateLimiter when Redis
  //             credentials are available (SP_UPSTASH_REDIS_REST_URL/TOKEN).
  c.set("rateLimiter", new InMemoryRateLimiter());

  // Wire captcha verifier.
  const env = c.env;
  const isDev = env.ENVIRONMENT !== "production";
  const captchaVerifier = isDev
    ? new DevBypassCaptchaVerifier({ env: env.ENVIRONMENT ?? "development" })
    : new TurnstileVerifier(env.SP_TURNSTILE_SECRET_KEY ?? "");
  c.set("captchaVerifier", captchaVerifier);

  // Wire form repository.
  // INCOMPLETE: D1FormRepository SQL queries are not yet implemented.
  //             DevFormRepository is used in development/test.
  const formRepo = isDev
    ? new DevFormRepository()
    : new D1FormRepository(env.DB);
  c.set("formRepository", formRepo);

  await next();
});

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

app.get("/health", (c) => {
  return c.json({ ok: true, service: brand.slug, ts: new Date().toISOString() });
});

// ---------------------------------------------------------------------------
// CORS preflight
// ---------------------------------------------------------------------------

app.options("/v1/forms/:publicFormId/submissions", async (c) => {
  const origin = c.req.header("origin") ?? null;
  // We reflect the origin if a form lookup were to allow it; for preflight
  // we return permissive headers and let the actual POST enforce the allowlist.
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": [
      "Content-Type",
      "Idempotency-Key",
      "X-Captcha-Response",
      brand.wire.requestIdHeader,
    ].join(", "),
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
  if (origin !== null) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Credentials"] = "true";
  }
  return new Response(null, { status: 204, headers });
});

// ---------------------------------------------------------------------------
// Main submission endpoint
// ---------------------------------------------------------------------------

app.post("/v1/forms/:publicFormId/submissions", async (c) => {
  const startMs = Date.now();
  const requestId = c.get("requestId");
  const clientIp = c.get("clientIp");

  // Detect synthetic health-check submissions.
  const isSynthetic =
    c.req.header(brand.wire.syntheticHeader) === "1" ||
    c.req.header(brand.wire.syntheticHeader) === "true";

  // Stage 1 — Request size (pre-form-lookup, use absolute max).
  const bodyResult = await readBodyWithSizeGuard(
    c.req.raw,
    26_214_400,
    requestId,
  );
  if (bodyResult instanceof Response) return bodyResult;
  const { body } = bodyResult;

  // Stage 2 — Form lookup.
  const publicFormId = c.req.param("publicFormId");
  const formResult = await lookupForm(
    publicFormId,
    c.get("formRepository"),
    requestId,
    null, // CORS origin unknown until after origin evaluation
  );
  if (formResult instanceof Response) return formResult;
  const { form } = formResult;

  // Re-enforce per-form body size limit now that we know it.
  if (body.byteLength > form.maxBodyBytes) {
    return Errors.payloadTooLarge(requestId, null);
  }

  // Stage 4 — Origin evaluation (before rate limiting to build corsOrigin).
  const originResult = evaluateRequestOrigin(c.req.raw, form, requestId);
  if (originResult instanceof Response) return originResult;
  const { corsOrigin } = originResult;

  // Stage 3 — Rate limits.
  const rateLimitResponse = await checkRateLimits(
    clientIp,
    form.id,
    c.get("rateLimiter"),
    requestId,
    corsOrigin,
  );
  if (rateLimitResponse !== null) return rateLimitResponse;

  // Idempotency-Key header.
  const idempotencyKey = c.req.header("idempotency-key") ?? null;

  // Stage 5 — Parse body and schema validation.
  const contentType = c.req.header("content-type") ?? "";
  const parsedResult = await parseBody(body, contentType, requestId, corsOrigin);
  if (parsedResult instanceof Response) return parsedResult;
  const { payload, files } = parsedResult;

  // Remove honeypot field from payload before validation (honeypot check is
  // done in spam stage; here we just strip it from schema validation).
  const payloadForValidation = { ...payload };

  const validationResult = runSchemaValidation(
    form,
    payloadForValidation,
    requestId,
    corsOrigin,
  );
  if (validationResult instanceof Response) return validationResult;
  const { data, unexpectedData } = validationResult;

  // Stage 6 — CAPTCHA.
  const captchaResult = await verifyCaptcha(
    form.captchaEnabled,
    data,
    c.req.raw,
    clientIp,
    c.get("captchaVerifier"),
    requestId,
    corsOrigin,
  );
  if (captchaResult instanceof Response) return captchaResult;
  const { cleanPayload } = captchaResult;

  // Stage 7 — Spam rules.
  // Inline rules only; AI analysis is deferred to the queue consumer.
  const spamEval = evaluateSpam(
    cleanPayload,
    form.honeypotFieldName,
    clientIp,
    [] as SpamRule[], // TODO: load from DB in D1FormRepository when implemented
  );

  // Block immediately only for "blocked" verdict (honeypot etc.).
  if (spamEval.verdict === "blocked") {
    return Errors.spamBlocked(requestId, corsOrigin);
  }

  // Stage 8 — File validation.
  const fileResult = await validateUploadedFiles(
    files,
    form.fields,
    form.fileUploadsEnabled,
    requestId,
    corsOrigin,
  );
  if (fileResult instanceof Response) return fileResult;

  // Stage 9 — Persistence.
  const persistResult = await persistSubmission(
    {
      formId: form.id,
      workspaceId: form.workspaceId,
      requestId,
      idempotencyKey,
      data: cleanPayload,
      unexpectedData,
      schemaVersionId: form.activeSchemaVersionId,
      spam: spamEval,
      clientIp,
      userAgent: c.req.header("user-agent") ?? null,
      referrer: c.req.header("referer") ?? null,
      originHeader: c.req.header("origin") ?? null,
      countryCode:
        (c.req.raw as Request & { cf?: { country?: string } }).cf?.country ?? null,
      isSynthetic,
    },
    c.get("formRepository"),
    c.env.IDEMPOTENCY_KV,
    requestId,
    corsOrigin,
  );
  if (persistResult instanceof Response) return persistResult;
  const { publicId } = persistResult;

  // Stage 10 — Enqueue (fire-and-forget; never fails the response).
  // NOTE: email, webhooks, AI analysis, file scanning happen in the queue consumer.
  if (!persistResult.isIdempotentRepeat) {
    await enqueueSubmission(c.env.SUBMISSION_QUEUE, {
      submissionId: persistResult.submissionId,
      formId: form.id,
      workspaceId: form.workspaceId,
      requestId,
      acceptedAt: new Date().toISOString(),
    });
  }

  // Stage 11 — Response.
  const processingMs = Date.now() - startMs;
  console.info("[ingest] accepted", {
    requestId,
    formId: form.id,
    publicId,
    processingMs,
    spam: spamEval.verdict,
    idempotent: persistResult.isIdempotentRepeat,
  });

  // Build response with brand-stamped header.
  const responseBody = JSON.stringify({
    ok: true,
    requestId,
    submissionId: publicId,
  });

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    [brand.wire.requestIdHeader]: requestId,
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "no-store",
  };
  if (corsOrigin !== null) {
    headers["Access-Control-Allow-Origin"] = corsOrigin;
    headers["Access-Control-Allow-Credentials"] = "true";
    headers["Access-Control-Expose-Headers"] = brand.wire.requestIdHeader;
    headers["Vary"] = "Origin";
  }

  return new Response(responseBody, { status: 202, headers });
});

// ---------------------------------------------------------------------------
// 404 catch-all
// ---------------------------------------------------------------------------

app.notFound((c) => {
  const requestId = c.get("requestId") ?? crypto.randomUUID();
  return Errors.badRequest(requestId, "Not found", null);
});

// ---------------------------------------------------------------------------
// Worker export
// ---------------------------------------------------------------------------

export default {
  fetch: app.fetch,
} satisfies ExportedHandler<Env>;
