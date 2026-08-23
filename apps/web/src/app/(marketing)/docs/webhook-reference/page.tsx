import type { Metadata } from "next";
import Link from "next/link";
import { brand } from "@submitpulse/config/brand";
import { CodeBlock, Badge } from "@submitpulse/ui";

export const metadata: Metadata = {
  title: `Webhook Reference — ${brand.name} Docs`,
  description: `Event payloads, signature verification, and worked HMAC examples for ${brand.name} webhooks.`,
};

// ---------------------------------------------------------------------------
// Wire constants (derived from brand — never hardcoded)
// ---------------------------------------------------------------------------

const SIG_HEADER = brand.wire.signatureHeader;
const TS_HEADER = brand.wire.timestampHeader;
const DID_HEADER = brand.wire.deliveryIdHeader;

// ---------------------------------------------------------------------------
// Event docs
// ---------------------------------------------------------------------------

interface EventDoc {
  readonly name: string;
  readonly description: string;
  readonly example: string;
}

const EVENTS: readonly EventDoc[] = [
  {
    name: "submission.created",
    description:
      "Fired asynchronously when a new, non-spam submission is accepted and processed. Not fired for synthetic (health-check) submissions.",
    example: JSON.stringify(
      {
        version: "v1",
        event: "submission.created",
        createdAt: "2025-06-01T12:00:00.000Z",
        workspaceId: "ws-uuid-here",
        formId: "form-uuid-here",
        data: {
          submissionId: "sub-internal-uuid",
          publicId: "sub_a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6",
          origin: "live",
          spamVerdict: "clean",
          fields: {
            name: "Alice Johnson",
            email: "alice@example.com",
            message: "Hello",
          },
          submittedAt: "2025-06-01T12:00:00.000Z",
        },
      },
      null,
      2,
    ),
  },
  {
    name: "submission.updated",
    description:
      "Fired when a submission's status, tags, assignment, or notes change in the dashboard. data.changes contains only the fields that changed.",
    example: JSON.stringify(
      {
        version: "v1",
        event: "submission.updated",
        createdAt: "2025-06-01T12:05:00.000Z",
        workspaceId: "ws-uuid-here",
        formId: "form-uuid-here",
        data: {
          submissionId: "sub-internal-uuid",
          publicId: "sub_a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6",
          changes: { status: "qualified" },
          updatedAt: "2025-06-01T12:05:00.000Z",
        },
      },
      null,
      2,
    ),
  },
  {
    name: "submission.spam",
    description:
      "Fired by the queue consumer after AI-based spam analysis classifies a submission as spam or blocked.",
    example: JSON.stringify(
      {
        version: "v1",
        event: "submission.spam",
        createdAt: "2025-06-01T12:00:30.000Z",
        workspaceId: "ws-uuid-here",
        formId: "form-uuid-here",
        data: {
          submissionId: "sub-internal-uuid",
          publicId: "sub_a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6",
          spamVerdict: "spam",
          spamScore: 0.92,
          signals: [
            {
              code: "keyword_match",
              label: "Keyword blocklist match",
              weight: 0.8,
              evidence: "Field 'message' contains blocked term",
            },
          ],
          detectedAt: "2025-06-01T12:00:30.000Z",
        },
      },
      null,
      2,
    ),
  },
  {
    name: "submission.restored",
    description:
      "Fired when a workspace member manually restores a spam-classified submission. restoredBy is 'user' or 'system'.",
    example: JSON.stringify(
      {
        version: "v1",
        event: "submission.restored",
        createdAt: "2025-06-01T14:00:00.000Z",
        workspaceId: "ws-uuid-here",
        formId: "form-uuid-here",
        data: {
          submissionId: "sub-internal-uuid",
          publicId: "sub_a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6",
          restoredBy: "user",
          restoredAt: "2025-06-01T14:00:00.000Z",
        },
      },
      null,
      2,
    ),
  },
  {
    name: "form.health.failed",
    description:
      "Fired when a Pulse Monitor synthetic health-check run fails. incidentId is present when a new incident was opened.",
    example: JSON.stringify(
      {
        version: "v1",
        event: "form.health.failed",
        createdAt: "2025-06-01T08:00:00.000Z",
        workspaceId: "ws-uuid-here",
        formId: "form-uuid-here",
        data: {
          healthMonitorId: "monitor-uuid",
          healthRunId: "run-uuid",
          failureStage: "form_located",
          failureReason: "Could not find form element on page",
          consecutiveFailures: 3,
          incidentId: "inc_01j...",
          failedAt: "2025-06-01T08:00:00.000Z",
        },
      },
      null,
      2,
    ),
  },
  {
    name: "form.schema.changed",
    description:
      "Fired when schema drift is detected — a field was added, removed, renamed, or its type changed relative to the stored active schema version.",
    example: JSON.stringify(
      {
        version: "v1",
        event: "form.schema.changed",
        createdAt: "2025-06-01T10:00:00.000Z",
        workspaceId: "ws-uuid-here",
        formId: "form-uuid-here",
        data: {
          schemaDriftEventId: "drift-uuid",
          kind: "field_renamed",
          fieldName: "email",
          previousDefinition: { name: "email", type: "email", required: true },
          observedDefinition: { name: "Email", type: "text", required: true },
          detectedAt: "2025-06-01T10:00:00.000Z",
        },
      },
      null,
      2,
    ),
  },
];

const NODE_VERIFY = `const { createHmac, timingSafeEqual } = require("node:crypto");

const SIGNATURE_HEADER = "${SIG_HEADER}";
const TIMESTAMP_HEADER = "${TS_HEADER}";
const REPLAY_WINDOW_SECONDS = 300;

function verifyWebhook(secret, rawBody, headers) {
  const rawTimestamp = headers[TIMESTAMP_HEADER];
  const rawSignature = headers[SIGNATURE_HEADER];

  if (!rawTimestamp || !rawSignature) {
    return { valid: false, reason: "Missing signature headers" };
  }

  const ts = parseInt(rawTimestamp, 10);
  if (!Number.isFinite(ts)) {
    return { valid: false, reason: "Invalid timestamp" };
  }

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > REPLAY_WINDOW_SECONDS) {
    return { valid: false, reason: "Timestamp outside replay window" };
  }

  if (!rawSignature.startsWith("sha256=")) {
    return { valid: false, reason: "Invalid signature format" };
  }

  const receivedHex = rawSignature.slice("sha256=".length);
  const signingPayload = \`\${ts}.\${rawBody}\`;
  const expectedHex = createHmac("sha256", secret)
    .update(signingPayload, "utf8")
    .digest("hex");

  const receivedBuf = Buffer.from(receivedHex, "hex");
  const expectedBuf = Buffer.from(expectedHex, "hex");

  if (receivedBuf.length !== expectedBuf.length) {
    return { valid: false, reason: "Signature length mismatch" };
  }

  // CONSTANT-TIME comparison — prevents timing attacks.
  const match = timingSafeEqual(receivedBuf, expectedBuf);
  return match ? { valid: true } : { valid: false, reason: "Signature mismatch" };
}

// Express example
app.post("/webhook", express.raw({ type: "application/json" }), (req, res) => {
  const result = verifyWebhook(
    process.env.WEBHOOK_SECRET,
    req.body.toString("utf8"), // raw bytes — do NOT parse JSON first
    req.headers,
  );
  if (!result.valid) return res.status(400).json({ error: result.reason });

  const event = JSON.parse(req.body);
  console.log("event:", event.event);
  res.sendStatus(200);
});`;

const PYTHON_VERIFY = `import hashlib
import hmac
import time

SIGNATURE_HEADER = "${SIG_HEADER}"
TIMESTAMP_HEADER = "${TS_HEADER}"
REPLAY_WINDOW_SECONDS = 300


def verify_webhook(secret: str, raw_body: bytes, headers: dict) -> dict:
    raw_timestamp = headers.get(TIMESTAMP_HEADER)
    raw_signature = headers.get(SIGNATURE_HEADER)

    if not raw_timestamp or not raw_signature:
        return {"valid": False, "reason": "Missing signature headers"}

    try:
        ts = int(raw_timestamp)
    except ValueError:
        return {"valid": False, "reason": "Invalid timestamp"}

    now = int(time.time())
    if abs(now - ts) > REPLAY_WINDOW_SECONDS:
        return {"valid": False, "reason": "Timestamp outside replay window"}

    if not raw_signature.startswith("sha256="):
        return {"valid": False, "reason": "Invalid signature format"}

    received_hex = raw_signature[len("sha256="):]
    signing_payload = f"{ts}.{raw_body.decode('utf-8')}"
    expected_hex = hmac.new(
        secret.encode("utf-8"),
        signing_payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    # Constant-time comparison — prevents timing attacks.
    if not hmac.compare_digest(received_hex, expected_hex):
        return {"valid": False, "reason": "Signature mismatch"}

    return {"valid": True}


# Flask example
from flask import Flask, request, abort
import json, os

app = Flask(__name__)

@app.route("/webhook", methods=["POST"])
def webhook():
    raw_body = request.get_data()  # raw bytes — do NOT call request.json first
    result = verify_webhook(
        secret=os.environ["WEBHOOK_SECRET"],
        raw_body=raw_body,
        headers={k.lower(): v for k, v in request.headers},
    )
    if not result["valid"]:
        abort(400, result.get("reason"))

    event = json.loads(raw_body)
    print("event:", event["event"])
    return "", 200`;

const SDK_VERIFY = `import { verifyWebhook } from "@submitpulse/webhooks";

// Edge / Node handler example
export async function POST(req: Request) {
  const rawBody = await req.text(); // raw string — before any JSON.parse
  const result = verifyWebhook(
    process.env.WEBHOOK_SECRET!,
    rawBody,
    Object.fromEntries(req.headers.entries()),
  );

  if (!result.valid) {
    return new Response(result.reason ?? "Unauthorized", { status: 401 });
  }

  const event = JSON.parse(rawBody);
  console.log("event:", event.event);
  return new Response(null, { status: 200 });
}`;

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function WebhookReferencePage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-16 lg:px-8">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="mb-8">
        <ol className="flex items-center gap-2 text-sm text-text-muted" role="list">
          <li>
            <Link
              href="/docs"
              className="hover:text-text-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring rounded"
            >
              Docs
            </Link>
          </li>
          <li aria-hidden className="select-none">/</li>
          <li className="text-text-primary font-medium">Webhook Reference</li>
        </ol>
      </nav>

      {/* Header */}
      <div className="mb-12">
        <h1 className="text-3xl font-bold tracking-tight text-text-primary mb-3">
          Webhook Reference
        </h1>
        <p className="text-base text-text-secondary leading-relaxed max-w-2xl">
          Submit Pulse sends signed HTTP POST requests to your HTTPS endpoint
          when events occur. Delivery is asynchronous — webhooks fire from the
          queue consumer, not inline with the 202 acceptance response.
        </p>
      </div>

      {/* Delivery format */}
      <section aria-labelledby="delivery-heading" className="mb-14">
        <h2
          id="delivery-heading"
          className="text-xl font-semibold text-text-primary mb-4"
        >
          Delivery format
        </h2>
        <CodeBlock
          code={`POST <your-endpoint-url>
Content-Type: application/json
User-Agent: ${brand.wire.userAgent}
${SIG_HEADER}:   sha256=<hex>
${TS_HEADER}:   <unix-seconds>
${DID_HEADER}: <uuid>`}
          language="http"
          copyable
          caption="Request headers on every webhook delivery"
        />
        <div className="mt-4 rounded-md border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-elevated border-b border-border">
                <th className="px-4 py-3 text-left text-xs text-text-muted font-medium">
                  Header
                </th>
                <th className="px-4 py-3 text-left text-xs text-text-muted font-medium">
                  Purpose
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[
                {
                  h: SIG_HEADER,
                  p: 'HMAC-SHA256 signature in the form sha256=<hex>',
                },
                {
                  h: TS_HEADER,
                  p: "Unix seconds (string). Used for replay-window verification.",
                },
                {
                  h: DID_HEADER,
                  p: "UUID per delivery attempt. Retries get a new ID.",
                },
              ].map((row) => (
                <tr key={row.h} className="hover:bg-surface-elevated/50">
                  <td className="px-4 py-3">
                    <code className="text-xs font-mono text-text-primary">
                      {row.h}
                    </code>
                  </td>
                  <td className="px-4 py-3 text-sm text-text-secondary">
                    {row.p}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Envelope */}
      <section aria-labelledby="envelope-heading" className="mb-14">
        <h2
          id="envelope-heading"
          className="text-xl font-semibold text-text-primary mb-4"
        >
          Payload envelope
        </h2>
        <p className="text-sm text-text-secondary mb-4 leading-relaxed">
          Every event shares the same outer structure. The{" "}
          <code className="text-xs font-mono bg-code-background px-1 py-0.5 rounded">
            version
          </code>{" "}
          field is incremented on breaking changes to any event's{" "}
          <code className="text-xs font-mono bg-code-background px-1 py-0.5 rounded">
            data
          </code>{" "}
          shape.
        </p>
        <CodeBlock
          code={JSON.stringify(
            {
              version: "v1",
              event: "<event-type>",
              createdAt: "2025-06-01T12:00:00.000Z",
              workspaceId: "<uuid>",
              formId: "<uuid>",
              data: {},
            },
            null,
            2,
          )}
          language="json"
          copyable
          caption="Shared envelope — all events"
        />
      </section>

      {/* Events */}
      <section aria-labelledby="events-heading" className="mb-14">
        <h2
          id="events-heading"
          className="text-xl font-semibold text-text-primary mb-6"
        >
          Events
        </h2>
        <div className="space-y-8">
          {EVENTS.map((ev) => (
            <div
              key={ev.name}
              id={ev.name.replace(".", "-")}
              className="scroll-mt-6"
            >
              <div className="flex items-center gap-3 mb-3">
                <Badge variant="info" size="sm">
                  <code className="font-mono text-xs">{ev.name}</code>
                </Badge>
              </div>
              <p className="text-sm text-text-secondary mb-3 leading-relaxed">
                {ev.description}
              </p>
              <CodeBlock
                code={ev.example}
                language="json"
                copyable
                caption={`${ev.name} payload`}
                maxHeight={400}
              />
            </div>
          ))}
        </div>
      </section>

      {/* Signature verification */}
      <section aria-labelledby="sig-heading" className="mb-14">
        <h2
          id="sig-heading"
          className="text-xl font-semibold text-text-primary mb-4"
        >
          Signature verification
        </h2>
        <div className="space-y-4 text-sm text-text-secondary leading-relaxed mb-6">
          <p>
            The signing payload is{" "}
            <code className="text-xs font-mono bg-code-background px-1 py-0.5 rounded">
              {"<timestamp>.<rawBody>"}
            </code>
            : the Unix timestamp string, a literal period, and the raw request
            body bytes.
          </p>
          <p>
            <strong className="text-text-primary">Critical:</strong> verify
            against the raw, unparsed body. Parsing JSON and re-serializing
            changes key ordering and whitespace, producing a different byte
            sequence that fails verification.
          </p>
          <p>
            <strong className="text-text-primary">Replay protection:</strong>{" "}
            reject requests where{" "}
            <code className="text-xs font-mono bg-code-background px-1 py-0.5 rounded">
              |now − timestamp| &gt; 300
            </code>{" "}
            seconds.
          </p>
          <p>
            <strong className="text-text-primary">Constant-time:</strong> use{" "}
            <code className="text-xs font-mono bg-code-background px-1 py-0.5 rounded">
              timingSafeEqual
            </code>{" "}
            (Node) or{" "}
            <code className="text-xs font-mono bg-code-background px-1 py-0.5 rounded">
              hmac.compare_digest
            </code>{" "}
            (Python). Naive string comparison leaks timing information.
          </p>
        </div>

        <CodeBlock
          code={`signingPayload = timestamp + "." + rawBody
signature      = HMAC-SHA256(signingPayload, secret)
headerValue    = "sha256=" + hex(signature)`}
          language="text"
          caption="Signing algorithm"
        />

        <div className="mt-8 space-y-6">
          <h3 className="text-base font-semibold text-text-primary">
            Node.js verification
          </h3>
          <CodeBlock
            code={NODE_VERIFY}
            language="javascript"
            copyable
            maxHeight={520}
            caption="Node.js — copy-paste ready"
          />

          <h3 className="text-base font-semibold text-text-primary">
            Python verification
          </h3>
          <CodeBlock
            code={PYTHON_VERIFY}
            language="python"
            copyable
            maxHeight={520}
            caption="Python — Flask example"
          />

          <h3 className="text-base font-semibold text-text-primary">
            SDK usage
          </h3>
          <p className="text-sm text-text-secondary leading-relaxed">
            If you have access to{" "}
            <code className="text-xs font-mono bg-code-background px-1 py-0.5 rounded">
              @submitpulse/webhooks
            </code>
            , use{" "}
            <code className="text-xs font-mono bg-code-background px-1 py-0.5 rounded">
              verifyWebhook()
            </code>{" "}
            directly. It enforces the 300-second replay window and uses{" "}
            <code className="text-xs font-mono bg-code-background px-1 py-0.5 rounded">
              timingSafeEqual
            </code>{" "}
            automatically.
          </p>
          <CodeBlock
            code={SDK_VERIFY}
            language="typescript"
            copyable
            caption="SDK usage — TypeScript"
          />
        </div>
      </section>

      {/* Retry behaviour */}
      <section aria-labelledby="retry-heading" className="mb-14">
        <h2
          id="retry-heading"
          className="text-xl font-semibold text-text-primary mb-4"
        >
          Retry behaviour
        </h2>
        <div className="space-y-3 text-sm text-text-secondary leading-relaxed">
          <p>
            Failed deliveries (non-2xx response or network timeout) are retried
            with exponential backoff. Return any 2xx status to acknowledge
            delivery. Return 4xx to signal a permanent failure (no retry).
            Return 5xx or let the request time out to trigger a retry.
          </p>
          <p>
            After sustained failures, the endpoint is automatically disabled.
            The{" "}
            <code className="text-xs font-mono bg-code-background px-1 py-0.5 rounded">
              consecutive_failures
            </code>{" "}
            counter and{" "}
            <code className="text-xs font-mono bg-code-background px-1 py-0.5 rounded">
              disabled_at
            </code>{" "}
            timestamp are visible in the dashboard.
          </p>
          <p>
            Retries of the same event produce a new{" "}
            <code className="text-xs font-mono bg-code-background px-1 py-0.5 rounded">
              {DID_HEADER}
            </code>{" "}
            but the same event{" "}
            <code className="text-xs font-mono bg-code-background px-1 py-0.5 rounded">
              data
            </code>
            . Use the delivery ID or{" "}
            <code className="text-xs font-mono bg-code-background px-1 py-0.5 rounded">
              data.submissionId
            </code>{" "}
            to deduplicate.
          </p>
        </div>
      </section>

      {/* Footer */}
      <div className="pt-8 border-t border-border">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 text-sm text-text-muted">
          <Link
            href="/docs/api"
            className="text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring rounded"
          >
            ← API Reference
          </Link>
          <span className="hidden sm:block" aria-hidden>
            ·
          </span>
          <a
            href={`mailto:${brand.email.support}`}
            className="text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring rounded"
          >
            Contact support
          </a>
        </div>
      </div>
    </div>
  );
}
