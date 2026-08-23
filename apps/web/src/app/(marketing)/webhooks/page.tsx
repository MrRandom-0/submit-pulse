import { Button, Badge, Card, CardContent, CardHeader, CardTitle, CardDescription } from "@submitpulse/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { brand } from "@submitpulse/config/brand";

export const metadata: Metadata = {
  title: `Webhooks — ${brand.name}`,
  description: `Receive form submissions as signed webhook payloads. Automatic retry, HMAC-SHA256 verification, and full delivery logs.`,
};

export default function WebhooksPage() {
  return (
    <>
      <section aria-labelledby="webhooks-heading" className="border-b border-border bg-background py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <Badge variant="neutral" className="mb-6">Webhooks</Badge>
            <h1 id="webhooks-heading" className="text-4xl font-bold tracking-tight text-text-primary sm:text-5xl">
              Reliable webhook delivery with automatic retry
            </h1>
            <p className="mt-6 text-lg text-text-secondary leading-relaxed">
              Every submission triggers a signed POST to your endpoint. Failed
              deliveries retry automatically. Full delivery logs show you
              exactly what was sent and when.
            </p>
            <div className="mt-8 flex justify-center gap-3">
              <Button variant="primary" size="lg" asChild>
                <Link href="/signup">Set up webhooks</Link>
              </Button>
              <Button variant="secondary" size="lg" asChild>
                <Link href={brand.domains.docs}>Webhook docs</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="webhook-features-heading" className="border-b border-border bg-surface py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <h2 id="webhook-features-heading" className="text-2xl font-bold tracking-tight text-text-primary mb-10">
            Features
          </h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                title: "HMAC-SHA256 signatures",
                body: `Every request carries an ${brand.wire.signatureHeader} header. Verify on your server to confirm authenticity.`,
              },
              {
                title: "Automatic retry",
                body: "Failed deliveries are retried with exponential back-off. Attempts are logged with response codes.",
              },
              {
                title: "Delivery ID header",
                body: `The ${brand.wire.deliveryIdHeader} header lets you deduplicate retried deliveries on your end.`,
              },
              {
                title: "Structured payloads",
                body: "Payloads include the full submission object, spam verdict, and metadata — not a raw form dump.",
              },
              {
                title: "Full delivery log",
                body: "Every attempt is logged with timestamp, HTTP status, response body, and retry count. Inspect failures from the dashboard.",
              },
              {
                title: "Multiple endpoints",
                body: "Configure multiple webhook endpoints per form. Each receives every submission independently.",
              },
            ].map((item) => (
              <Card key={item.title}>
                <CardHeader>
                  <CardTitle className="text-base">{item.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>{item.body}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="webhook-payload-heading" className="border-b border-border bg-background py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-3xl">
            <h2 id="webhook-payload-heading" className="text-2xl font-bold tracking-tight text-text-primary mb-6">
              Payload reference
            </h2>
            <div className="rounded-card border border-border bg-code-background p-6 font-mono">
              <pre className="overflow-x-auto text-xs text-text-secondary leading-relaxed">
                <code>{`POST https://your-server.com/webhook
Content-Type: application/json
${brand.wire.signatureHeader}: sha256=abc123...
${brand.wire.timestampHeader}: 1713012345
${brand.wire.deliveryIdHeader}: whk_01j...
${brand.wire.requestIdHeader}: req_01j...

{
  "event": "submission.received",
  "deliveryId": "whk_01j...",
  "attempt": 1,
  "submission": {
    "id": "sub_01j...",
    "formId": "fm_...",
    "fields": {
      "name": "Alex",
      "email": "alex@example.com",
      "message": "Hello there"
    },
    "spam": {
      "score": 0.02,
      "verdict": "clean"
    },
    "receivedAt": "2025-04-12T09:41:00Z"
  }
}`}</code>
              </pre>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="webhook-verify-heading" className="border-b border-border bg-surface py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-3xl">
            <h2 id="webhook-verify-heading" className="text-2xl font-bold tracking-tight text-text-primary mb-6">
              Signature verification
            </h2>
            <div className="rounded-card border border-border bg-code-background p-6 font-mono">
              <pre className="overflow-x-auto text-xs text-text-secondary leading-relaxed">
                <code>{`// Node.js / Next.js API route
import { createHmac, timingSafeEqual } from "crypto";

export async function POST(req: Request) {
  const body = await req.arrayBuffer();
  const rawBody = Buffer.from(body);
  const signature = req.headers.get("${brand.wire.signatureHeader}") ?? "";
  const secret = process.env.WEBHOOK_SECRET ?? "";

  const expected = "sha256=" + createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  const valid = timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );

  if (!valid) {
    return new Response("Unauthorized", { status: 401 });
  }

  const submission = JSON.parse(rawBody.toString());
  // handle submission...
  return new Response("OK");
}`}</code>
              </pre>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-background py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-text-primary">
            Start receiving webhooks
          </h2>
          <div className="mt-8 flex justify-center gap-3">
            <Button variant="primary" size="lg" asChild>
              <Link href="/signup">Create your endpoint</Link>
            </Button>
            <Button variant="secondary" size="lg" asChild>
              <Link href={brand.domains.docs}>Full webhook docs</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
