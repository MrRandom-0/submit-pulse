/**
 * Stage 4 — Origin evaluation.
 *
 * Enforce allowed-origin rules from form_domains.
 * Only applied when the form has `enforce_origin = true`.
 * When enforcement is off, the origin is still read for CORS header generation.
 *
 * Returns corsOrigin (the value to reflect in Access-Control-Allow-Origin)
 * even on success, so downstream stages can attach it to responses.
 */

import { evaluateOrigin, buildCorsOriginHeader } from "@submitpulse/security/origin";
import type { AllowedDomain } from "@submitpulse/security/origin";
import type { FormRow } from "../types.js";
import { Errors } from "../response.js";

export function evaluateRequestOrigin(
  request: Request,
  form: FormRow,
  requestId: string,
): { corsOrigin: string | null } | Response {
  const origin = request.headers.get("origin");

  const allowedDomains: readonly AllowedDomain[] = form.domains.map((d) => ({
    host: d.host,
    includeSubdomains: d.includeSubdomains,
  }));

  // Compute what CORS header value to reflect.
  const corsOrigin = buildCorsOriginHeader(origin, allowedDomains, form.allowLocalhost);

  // Only block when origin enforcement is enabled.
  if (form.enforceOrigin) {
    const verdict = evaluateOrigin(origin, allowedDomains, form.allowLocalhost);
    if (!verdict.allowed) {
      return Errors.originRejected(requestId, null);
    }
  }

  return { corsOrigin };
}
