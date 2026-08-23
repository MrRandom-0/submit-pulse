import { Button, Badge, Card, CardContent, CardHeader, CardTitle, CardDescription } from "@submitpulse/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { brand } from "@submitpulse/config/brand";

export const metadata: Metadata = {
  title: `Developer Overview — ${brand.name}`,
  description: `${brand.name} REST API, typed SDKs, and MCP server. Add production-ready form infrastructure to any stack.`,
};

export default function DevelopersPage() {
  return (
    <>
      {/* Header */}
      <section aria-labelledby="dev-heading" className="border-b border-border bg-background py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <Badge variant="neutral" className="mb-6">Developers</Badge>
            <h1 id="dev-heading" className="text-4xl font-bold tracking-tight text-text-primary sm:text-5xl">
              {brand.taglineAlt}
            </h1>
            <p className="mt-6 text-lg text-text-secondary leading-relaxed">
              A full REST API, typed browser and React SDKs, and an MCP server
              so AI coding agents can manage forms programmatically. Works with
              any stack that can make an HTTP request.
            </p>
            <div className="mt-8 flex justify-center gap-3">
              <Button variant="primary" size="lg" asChild>
                <Link href={brand.domains.docs}>Read the docs</Link>
              </Button>
              <Button variant="secondary" size="lg" asChild>
                <Link href="/signup">Get API key</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* API overview */}
      <section aria-labelledby="api-overview-heading" className="border-b border-border bg-surface py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:items-start">
            <div>
              <h2 id="api-overview-heading" className="text-3xl font-bold tracking-tight text-text-primary mb-6">
                REST API
              </h2>
              <p className="text-base text-text-secondary leading-relaxed mb-6">
                Every resource — forms, submissions, webhooks, incidents — is
                accessible via authenticated REST. Use your{" "}
                <code className="text-xs bg-code-background px-1.5 py-0.5 rounded font-mono">
                  {brand.identifiers.apiKeyLive}_...
                </code>{" "}
                key for live requests or a test key during development.
              </p>
              <ul className="flex flex-col gap-3 text-sm text-text-secondary" role="list">
                {[
                  "JSON request and response bodies",
                  "Cursor-based pagination on list endpoints",
                  "Idempotency keys on write endpoints",
                  "Webhook signature verification",
                  "Typed error codes and machine-readable error bodies",
                ].map((item) => (
                  <li key={item} className="flex gap-3">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary flex-none mt-1.5" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-card border border-border bg-code-background p-6 font-mono">
              <pre className="overflow-x-auto text-xs text-text-secondary leading-relaxed">
                <code>{`# List submissions for a form
curl "${brand.domains.api}/v1/forms/fm_xxx/submissions" \\
  -H "Authorization: Bearer ${brand.identifiers.apiKeyLive}_..."

# Response
{
  "data": [
    {
      "id": "sub_01j...",
      "fields": { "name": "Alex", "email": "..." },
      "spam": { "score": 0.02, "verdict": "clean" },
      "receivedAt": "2025-04-12T09:41:00Z"
    }
  ],
  "nextCursor": "sub_01j...",
  "hasMore": true
}`}</code>
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* SDKs */}
      <section aria-labelledby="sdks-heading" className="border-b border-border bg-background py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <h2 id="sdks-heading" className="text-3xl font-bold tracking-tight text-text-primary text-center mb-12">
            Typed client SDKs
          </h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>
                  <code className="font-mono text-sm">{brand.packages.browser}</code>
                </CardTitle>
                <CardDescription>
                  Framework-agnostic browser client. Use with any static site
                  or vanilla JS project.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded border border-border bg-code-background p-4 font-mono">
                  <pre className="text-xs text-text-secondary overflow-x-auto">
                    <code>{`import { createClient } from "${brand.packages.browser}";

const client = createClient({ formId: "fm_..." });

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const res = await client.submit(
    new FormData(form)
  );
  if (res.ok) showSuccess();
});`}</code>
                  </pre>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>
                  <code className="font-mono text-sm">{brand.packages.react}</code>
                </CardTitle>
                <CardDescription>
                  React hooks with built-in loading, error, and success states.
                  Works with Next.js App Router.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded border border-border bg-code-background p-4 font-mono">
                  <pre className="text-xs text-text-secondary overflow-x-auto">
                    <code>{`import { useSubmit } from "${brand.packages.react}";

function ContactForm() {
  const { submit, state, error } =
    useSubmit("fm_...");

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      submit(new FormData(e.currentTarget));
    }}>
      {state === "success" && <p>Sent!</p>}
    </form>
  );
}`}</code>
                  </pre>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* MCP server */}
      <section aria-labelledby="mcp-heading" className="border-b border-border bg-surface py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <Badge variant="info" className="mb-4">Pro+</Badge>
              <h2 id="mcp-heading" className="text-3xl font-bold tracking-tight text-text-primary">
                MCP server for AI coding agents
              </h2>
              <p className="mt-4 text-base text-text-secondary leading-relaxed">
                The {brand.name} MCP server exposes tools that let AI coding
                agents — Claude Code, Cursor, Codex, and others — create and
                configure forms programmatically during project setup. No
                manual dashboard steps required.
              </p>
              <ul className="mt-6 flex flex-col gap-2 text-sm text-text-secondary" role="list">
                {[
                  "create_form — provision a new endpoint",
                  "get_integration_prompt — fetch the builder-specific prompt",
                  "list_submissions — read recent submissions",
                  "get_incident — fetch the latest health status",
                ].map((item) => (
                  <li key={item} className="flex gap-3 font-mono text-xs">
                    <span className="h-1.5 w-1.5 rounded-full bg-info flex-none mt-1" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-card border border-border bg-code-background p-6 font-mono">
              <pre className="overflow-x-auto text-xs text-text-secondary leading-relaxed">
                <code>{`# .cursor/mcp.json
{
  "mcpServers": {
    "${brand.slug}": {
      "command": "npx",
      "args": ["-y", "${brand.packages.scope}/mcp"],
      "env": {
        "${brand.env.var("API_KEY")}": "..."
      }
    }
  }
}`}</code>
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* Webhook signatures */}
      <section aria-labelledby="webhooks-dev-heading" className="border-b border-border bg-background py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-3xl">
            <h2 id="webhooks-dev-heading" className="text-3xl font-bold tracking-tight text-text-primary mb-6">
              Verified webhook delivery
            </h2>
            <p className="text-base text-text-secondary leading-relaxed mb-6">
              Every outbound webhook is signed with HMAC-SHA256. Verify the
              signature on your server to confirm the request came from{" "}
              {brand.name}.
            </p>
            <div className="rounded-card border border-border bg-code-background p-6 font-mono">
              <pre className="overflow-x-auto text-xs text-text-secondary leading-relaxed">
                <code>{`// Node.js signature verification
import { createHmac, timingSafeEqual } from "crypto";

function verifyWebhook(
  rawBody: Buffer,
  signature: string, // from ${brand.wire.signatureHeader}
  secret: string
): boolean {
  const expected = createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  return timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}`}</code>
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-surface py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-text-primary">
            Ready to start building?
          </h2>
          <div className="mt-8 flex justify-center gap-3">
            <Button variant="primary" size="lg" asChild>
              <Link href={brand.domains.docs}>View documentation</Link>
            </Button>
            <Button variant="secondary" size="lg" asChild>
              <Link href="/signup">Get your API key</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
