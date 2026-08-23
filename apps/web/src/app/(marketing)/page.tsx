import { Button, Badge, Card, CardContent, CardHeader, CardTitle, CardDescription, cn } from "@submitpulse/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { brand } from "@submitpulse/config/brand";
import { ORDERED_BUILDERS } from "@submitpulse/config/builders";
import { ORDERED_PLANS, formatQuota } from "@submitpulse/config/entitlements";

export const metadata: Metadata = {
  title: `${brand.tagline} — ${brand.name}`,
  description: brand.description,
};

/* ─── Hero pipeline SVG ─── */
function PipelineDiagram() {
  const steps = [
    { id: "ai", label: "AI Website", sub: "HTML / React / Vue" },
    { id: "endpoint", label: "Endpoint", sub: brand.domains.api.replace("https://", "") },
    { id: "validate", label: "Validate", sub: "Schema & CSRF" },
    { id: "protect", label: "Protect", sub: "Spam Shield" },
    { id: "deliver", label: "Deliver", sub: "Email / Webhook" },
    { id: "monitor", label: "Monitor", sub: "Pulse & Alerts" },
  ] as const;

  return (
    <figure
      aria-label="Form submission pipeline: AI Website → Endpoint → Validate → Protect → Deliver → Monitor"
      className="w-full overflow-x-auto py-2"
    >
      <svg
        viewBox="0 0 760 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full min-w-[540px] max-w-3xl mx-auto"
        aria-hidden="true"
      >
        {/* Connector lines */}
        {[0, 1, 2, 3, 4].map((i) => (
          <line
            key={i}
            x1={60 + i * 130 + 50}
            y1="60"
            x2={60 + (i + 1) * 130}
            y2="60"
            stroke="currentColor"
            className="text-border"
            strokeWidth="1.5"
            strokeDasharray="4 3"
          />
        ))}

        {/* Arrow heads */}
        {[0, 1, 2, 3, 4].map((i) => {
          const x = 60 + (i + 1) * 130;
          return (
            <polygon
              key={i}
              points={`${x - 5},55 ${x},60 ${x - 5},65`}
              fill="currentColor"
              className="text-border"
            />
          );
        })}

        {/* Boxes */}
        {steps.map((step, i) => {
          const cx = 60 + i * 130;
          const isFirst = i === 0;
          const isLast = i === steps.length - 1;
          return (
            <g key={step.id}>
              <rect
                x={cx}
                y="36"
                width="50"
                height="48"
                rx="6"
                className={cn(
                  isFirst
                    ? "fill-surface stroke-border"
                    : isLast
                    ? "fill-primary/10 stroke-primary/40"
                    : "fill-surface-elevated stroke-border"
                )}
                strokeWidth="1"
              />
              <text
                x={cx + 25}
                y="57"
                textAnchor="middle"
                fontSize="7"
                fontWeight="600"
                className="fill-text-primary"
                style={{ fontFamily: "var(--sp-font-sans)" }}
              >
                {step.label}
              </text>
              <text
                x={cx + 25}
                y="70"
                textAnchor="middle"
                fontSize="6"
                className="fill-text-muted"
                style={{ fontFamily: "var(--sp-font-mono)" }}
              >
                {step.sub}
              </text>
            </g>
          );
        })}

        {/* Pulse dot on monitor */}
        <circle cx="695" cy="38" r="4" className="fill-success" />
        <circle cx="695" cy="38" r="7" className="fill-success/20" />
      </svg>
    </figure>
  );
}

/* ─── Why AI forms fail ─── */
const FAILURE_REASONS = [
  {
    icon: "⚠",
    title: "Silent submission drops",
    body: "AI builders wire up a POST action and move on. When the endpoint is wrong or the server is down, the user sees nothing and the lead is gone.",
  },
  {
    icon: "🔍",
    title: "No spam filtering",
    body: "Static and AI-generated forms have no server to run reCAPTCHA validation. Bots find the endpoint within hours.",
  },
  {
    icon: "📭",
    title: "Email delivery is fragile",
    body: "Sending email from a serverless function means bounces, DMARC failures, and inbox routing issues — none of which surface to the site owner.",
  },
  {
    icon: "🔀",
    title: "Schema drift goes unnoticed",
    body: "When the AI redesigns the form, the field names change. Old integrations break without error. Submissions accumulate in a broken state.",
  },
] as const;

/* ─── Feature sections ─── */
const FEATURE_SECTIONS = [
  {
    id: "inbox",
    badge: "Submission Inbox",
    badgeVariant: "info" as const,
    title: "Every submission, searchable and permanent",
    body: "Every form submission is stored, searchable, and exportable. Filter by date, field value, or spam score. View raw payloads. Nothing disappears.",
    code: `// submissions arrive structured
{
  id: "sub_01j...",
  formId: "fm_...",
  fields: { name: "Alex", email: "alex@..." },
  spam: { score: 0.02, verdict: "clean" },
  receivedAt: "2025-04-12T09:41:00Z"
}`,
  },
  {
    id: "spam",
    badge: "Spam Shield",
    badgeVariant: "warning" as const,
    title: "Multi-layer spam protection without CAPTCHA friction",
    body: "Honeypot fields, submission velocity limits, domain reputation scoring, and ML-based content analysis — all applied server-side before a submission is ever stored.",
    code: `// spam verdict in the response header
x-submitpulse-spam-score: 0.91
x-submitpulse-spam-verdict: blocked
x-submitpulse-spam-reason: domain_reputation`,
  },
  {
    id: "pipeline",
    badge: "Delivery Pipeline",
    badgeVariant: "success" as const,
    title: "Reliable delivery with automatic retry",
    body: "Email notifications, webhook calls, and integrations run through a durable queue. Failed deliveries retry with exponential back-off. You always know what was delivered and when.",
    code: `// webhook payload
{
  event: "submission.received",
  delivery_id: "whk_01j...",
  attempt: 1,
  submission: { ... }
}`,
  },
  {
    id: "monitor",
    badge: "Pulse Monitor",
    badgeVariant: "info" as const,
    title: "Know the moment a form breaks",
    body: "Synthetic health tests submit to your forms on a schedule. If a form stops accepting submissions or returns an error, you get alerted before any real user hits the problem.",
    code: `// incident alert
{
  id: "inc_01j...",
  form: "Contact Us",
  test: "health_check",
  status: "failing",
  since: "2025-04-12T08:00:00Z"
}`,
  },
  {
    id: "schema",
    badge: "Schema Drift",
    badgeVariant: "warning" as const,
    title: "Catch field renames before they break your integrations",
    body: "When an AI re-generates a form with different field names, Schema Drift detection flags the change and tells you exactly which fields disappeared and which appeared.",
    code: `// schema drift alert
{
  removed: ["full_name", "message"],
  added: ["name", "body"],
  affected_webhooks: 2,
  affected_autoresponders: 1
}`,
  },
] as const;

const FAQ_ITEMS = [
  {
    q: `Do I need a server to use ${brand.name}?`,
    a: `No. ${brand.name} is the server. Point your form's action attribute or fetch call at your endpoint URL and everything else is handled — validation, spam filtering, storage, delivery, and monitoring.`,
  },
  {
    q: "Will my AI builder break the integration when it regenerates code?",
    a: "It might change field names, which is exactly what Schema Drift detection catches. The endpoint URL and API key live outside the AI's reach, so the connection itself stays intact.",
  },
  {
    q: "How does spam protection work without CAPTCHA?",
    a: "Server-side honeypots, velocity limits, domain reputation, and ML scoring — all applied before a submission is stored. Most bots are blocked without any user-facing friction.",
  },
  {
    q: "Can I receive file uploads?",
    a: `Yes, on Pro and Agency plans. ${brand.name} accepts multipart form data, stores files in isolated storage, and delivers signed download links to your webhook or inbox.`,
  },
  {
    q: "What happens if my form goes down while I'm asleep?",
    a: "Pulse Monitor runs synthetic health tests on a schedule. If a form fails to accept submissions, you receive an incident alert immediately — not when a user complains.",
  },
  {
    q: "Is there an API?",
    a: `Yes. Every resource is available via the REST API. We also publish ${brand.packages.browser} and ${brand.packages.react} as typed client SDKs.`,
  },
] as const;

export default function HomePage() {
  const displayBuilders = ORDERED_BUILDERS.filter(
    (b) => b.category !== "other"
  ).slice(0, 12);

  const pricingPlans = ORDERED_PLANS.slice(1, 4); // Starter, Pro, Agency

  return (
    <>
      {/* ── Hero ── */}
      <section
        aria-labelledby="hero-heading"
        className="relative overflow-hidden border-b border-border bg-background"
      >
        <div className="mx-auto max-w-7xl px-6 pt-24 pb-20 lg:px-8 lg:pt-32 lg:pb-28">
          <div className="mx-auto max-w-3xl text-center">
            <Badge variant="neutral" className="mb-6">
              Form infrastructure for AI-generated websites
            </Badge>
            <h1
              id="hero-heading"
              className="text-4xl font-bold tracking-tight text-text-primary sm:text-5xl lg:text-6xl"
            >
              {brand.tagline}
            </h1>
            <p className="mt-6 text-lg text-text-secondary leading-relaxed max-w-2xl mx-auto">
              Add production-ready forms to AI-generated websites in minutes.
              Receive submissions, block spam, deliver leads and know when your
              forms break.
            </p>
            <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Button variant="primary" size="lg" asChild>
                <Link href="/signup">Create your endpoint</Link>
              </Button>
              <Button variant="secondary" size="lg" asChild>
                <Link href="/product">See 2-minute setup</Link>
              </Button>
            </div>
          </div>

          <div className="mt-16 rounded-card border border-border bg-surface p-6 shadow-card">
            <PipelineDiagram />
          </div>
        </div>
      </section>

      {/* ── Trust strip ── */}
      <section
        aria-labelledby="builders-heading"
        className="border-b border-border bg-surface py-12"
      >
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <p
            id="builders-heading"
            className="text-center text-sm text-text-muted mb-8"
          >
            Works with websites built using…
          </p>
          <ul
            className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4"
            role="list"
            aria-label="Supported website builders and frameworks"
          >
            {displayBuilders.map((builder) => (
              <li
                key={builder.id}
                className="text-sm font-medium text-text-secondary"
              >
                {builder.label}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Why AI-generated forms fail ── */}
      <section
        aria-labelledby="why-heading"
        className="border-b border-border bg-background py-24"
      >
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center mb-16">
            <h2
              id="why-heading"
              className="text-3xl font-bold tracking-tight text-text-primary sm:text-4xl"
            >
              Why AI-generated forms fail silently
            </h2>
            <p className="mt-4 text-base text-text-secondary">
              AI builders are excellent at producing UI. They were not designed
              to build production form infrastructure.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {FAILURE_REASONS.map((r) => (
              <Card key={r.title}>
                <CardContent className="pt-6">
                  <span className="text-2xl" aria-hidden="true">
                    {r.icon}
                  </span>
                  <h3 className="mt-4 text-base font-semibold text-text-primary">
                    {r.title}
                  </h3>
                  <p className="mt-2 text-sm text-text-secondary leading-relaxed">
                    {r.body}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── Three-minute setup ── */}
      <section
        aria-labelledby="setup-heading"
        className="border-b border-border bg-surface py-24"
      >
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center mb-16">
            <h2
              id="setup-heading"
              className="text-3xl font-bold tracking-tight text-text-primary sm:text-4xl"
            >
              Three-minute setup
            </h2>
            <p className="mt-4 text-base text-text-secondary">
              Create an endpoint, paste it into your site. Done.
            </p>
          </div>
          <ol className="mx-auto max-w-3xl flex flex-col gap-8" role="list">
            {[
              {
                n: "1",
                title: "Create an endpoint",
                body: `Sign up and create a form. You receive a unique endpoint URL — ${brand.domains.api}/v1/forms/{id}/submissions — and an optional API key.`,
              },
              {
                n: "2",
                title: "Connect your form",
                body: "Set your form's action to the endpoint URL, or copy the AI integration prompt and paste it into your builder's chat. The prompt generates the correct fetch call for your tool.",
              },
              {
                n: "3",
                title: "Configure delivery",
                body: "Tell us where submissions go — email address, Slack webhook, or your own webhook URL. Set up autoresponders. Configure spam thresholds.",
              },
              {
                n: "4",
                title: "Monitor automatically",
                body: "Pulse Monitor begins health tests. Schema Drift watches for field name changes. You will know before any user does if something breaks.",
              },
            ].map((step) => (
              <li key={step.n} className="flex gap-6">
                <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full border border-border bg-surface-elevated text-sm font-semibold text-text-primary">
                  {step.n}
                </span>
                <div>
                  <h3 className="text-base font-semibold text-text-primary">
                    {step.title}
                  </h3>
                  <p className="mt-1 text-sm text-text-secondary leading-relaxed">
                    {step.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── AI Integration Prompt ── */}
      <section
        aria-labelledby="ai-prompt-heading"
        className="border-b border-border bg-background py-24"
      >
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <Badge variant="info" className="mb-4">
                AI Integration Prompt
              </Badge>
              <h2
                id="ai-prompt-heading"
                className="text-3xl font-bold tracking-tight text-text-primary sm:text-4xl"
              >
                Paste one prompt. Your AI builder does the rest.
              </h2>
              <p className="mt-4 text-base text-text-secondary leading-relaxed">
                Pick your tool — Lovable, Bolt, Cursor, Claude Code and more —
                and receive a builder-specific prompt that instructs the AI to
                wire up your form correctly. The prompt accounts for each
                tool's quirks: environment variable support, whether the agent
                understands repo-wide instructions, and the idiomatic fetch
                pattern.
              </p>
              <div className="mt-8">
                <Button variant="primary" asChild>
                  <Link href="/ai-builders">Choose your builder</Link>
                </Button>
              </div>
            </div>
            <div className="rounded-card border border-border bg-surface p-6 font-mono text-sm">
              <div className="flex items-center gap-2 mb-4">
                <span className="h-2.5 w-2.5 rounded-full bg-danger/60" />
                <span className="h-2.5 w-2.5 rounded-full bg-warning/60" />
                <span className="h-2.5 w-2.5 rounded-full bg-success/60" />
                <span className="ml-2 text-xs text-text-muted font-sans">
                  Integration prompt · Lovable
                </span>
              </div>
              <pre className="overflow-x-auto text-xs text-text-secondary leading-relaxed whitespace-pre-wrap">
                <code>{`Update the contact form so that when it is
submitted it sends a POST request to:

  ${brand.domains.api}/v1/forms/fm_example/submissions

Use fetch() with:
  method: "POST"
  headers: { "Content-Type": "application/json" }
  body: JSON.stringify({ name, email, message })

Show a success message on 2xx and an error on
failure. Keep this in a dedicated ContactForm
component so later redesigns do not remove it.`}</code>
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* ── Feature sections ── */}
      {FEATURE_SECTIONS.map((section, i) => (
        <section
          key={section.id}
          aria-labelledby={`${section.id}-heading`}
          className={cn(
            "border-b border-border py-24",
            i % 2 === 0 ? "bg-surface" : "bg-background"
          )}
        >
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div
              className={cn(
                "grid grid-cols-1 gap-12 lg:grid-cols-2 lg:items-center",
                i % 2 !== 0 && "lg:grid-flow-dense"
              )}
            >
              <div className={cn(i % 2 !== 0 && "lg:col-start-2")}>
                <Badge variant={section.badgeVariant} className="mb-4">
                  {section.badge}
                </Badge>
                <h2
                  id={`${section.id}-heading`}
                  className="text-3xl font-bold tracking-tight text-text-primary sm:text-4xl"
                >
                  {section.title}
                </h2>
                <p className="mt-4 text-base text-text-secondary leading-relaxed">
                  {section.body}
                </p>
              </div>
              <div
                className={cn(
                  "rounded-card border border-border bg-code-background p-6 font-mono",
                  i % 2 !== 0 && "lg:col-start-1 lg:row-start-1"
                )}
              >
                <pre className="overflow-x-auto text-xs text-text-secondary leading-relaxed">
                  <code>{section.code}</code>
                </pre>
              </div>
            </div>
          </div>
        </section>
      ))}

      {/* ── Developer API ── */}
      <section
        aria-labelledby="api-heading"
        className="border-b border-border bg-background py-24"
      >
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <Badge variant="neutral" className="mb-4">
                Developer API
              </Badge>
              <h2
                id="api-heading"
                className="text-3xl font-bold tracking-tight text-text-primary sm:text-4xl"
              >
                Full REST API. Typed SDKs. MCP server.
              </h2>
              <p className="mt-4 text-base text-text-secondary leading-relaxed">
                Every resource is accessible via REST. Use{" "}
                <code className="text-xs bg-code-background px-1.5 py-0.5 rounded font-mono">
                  {brand.packages.browser}
                </code>{" "}
                for browser apps or{" "}
                <code className="text-xs bg-code-background px-1.5 py-0.5 rounded font-mono">
                  {brand.packages.react}
                </code>{" "}
                for React hooks. The MCP server lets AI coding agents manage
                forms programmatically during project setup.
              </p>
              <div className="mt-8 flex gap-3">
                <Button variant="secondary" asChild>
                  <Link href={brand.domains.docs}>Read the docs</Link>
                </Button>
                <Button variant="ghost" asChild>
                  <Link href="/developers">Developer overview</Link>
                </Button>
              </div>
            </div>
            <div className="rounded-card border border-border bg-code-background p-6 font-mono">
              <pre className="overflow-x-auto text-xs text-text-secondary leading-relaxed">
                <code>{`// ${brand.packages.react}
import { useSubmit } from "${brand.packages.react}";

function ContactForm() {
  const { submit, state } = useSubmit("fm_...");

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
          </div>
        </div>
      </section>

      {/* ── Agency Mode ── */}
      <section
        aria-labelledby="agency-heading"
        className="border-b border-border bg-surface py-24"
      >
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center mb-16">
            <Badge variant="neutral" className="mb-4">
              Agency Mode
            </Badge>
            <h2
              id="agency-heading"
              className="text-3xl font-bold tracking-tight text-text-primary sm:text-4xl"
            >
              Manage all your clients from one dashboard
            </h2>
            <p className="mt-4 text-base text-text-secondary">
              Agency plan gives you client workspaces, white-label reports, and
              a shared dashboard across every site you manage.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {[
              {
                title: "Client workspaces",
                body: "Isolate each client's forms, submissions, and billing. Hand off access without exposing other clients.",
              },
              {
                title: "Aggregate dashboard",
                body: "See health status, submission volume, and delivery rates across all client sites from a single view.",
              },
              {
                title: "White-label reports",
                body: "Export branded PDF reports of form performance and delivery metrics to share with clients.",
              },
            ].map((item) => (
              <Card key={item.title}>
                <CardHeader>
                  <CardTitle>{item.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>{item.body}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Button variant="secondary" asChild>
              <Link href="/agencies">Learn about Agency plan</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── Security ── */}
      <section
        aria-labelledby="security-heading"
        className="border-b border-border bg-background py-24"
      >
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center mb-16">
            <Badge variant="success" className="mb-4">
              Security
            </Badge>
            <h2
              id="security-heading"
              className="text-3xl font-bold tracking-tight text-text-primary sm:text-4xl"
            >
              Built for public form endpoints
            </h2>
            <p className="mt-4 text-base text-text-secondary">
              Form endpoints are public by design. Security comes from domain
              rules, rate limiting, and signed webhooks — not from obscuring the
              URL.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                title: "Domain allowlists",
                body: "Restrict submissions to specific origins. Requests from other domains are rejected.",
              },
              {
                title: "Signed webhooks",
                body: `Every outbound webhook carries an ${brand.wire.signatureHeader} header so your server can verify authenticity.`,
              },
              {
                title: "TLS everywhere",
                body: "All data in transit is encrypted. The API is HTTPS-only with HSTS enforced.",
              },
              {
                title: "GDPR ready",
                body: "Submission data is stored in your configured region. Retention limits delete old submissions automatically.",
              },
            ].map((item) => (
              <div key={item.title}>
                <h3 className="text-sm font-semibold text-text-primary mb-2">
                  {item.title}
                </h3>
                <p className="text-sm text-text-secondary">{item.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Button variant="ghost" asChild>
              <Link href="/security">Security overview →</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── Pricing preview ── */}
      <section
        aria-labelledby="pricing-preview-heading"
        className="border-b border-border bg-surface py-24"
      >
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center mb-16">
            <h2
              id="pricing-preview-heading"
              className="text-3xl font-bold tracking-tight text-text-primary sm:text-4xl"
            >
              Simple, transparent pricing
            </h2>
            <p className="mt-4 text-base text-text-secondary">
              Start free. Upgrade when you need more.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {pricingPlans.map((plan) => (
              <Card
                key={plan.id}
                className={cn(plan.id === "pro" && "border-primary/40 shadow-elevated")}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{plan.name}</CardTitle>
                    {plan.id === "pro" && (
                      <Badge variant="info" size="sm">
                        Popular
                      </Badge>
                    )}
                  </div>
                  <p className="text-3xl font-bold text-text-primary mt-2">
                    ${(plan.priceMonthlyCents / 100).toFixed(0)}
                    <span className="text-base font-regular text-text-muted">
                      /mo
                    </span>
                  </p>
                </CardHeader>
                <CardContent className="pt-4">
                  <ul className="flex flex-col gap-2 text-sm text-text-secondary">
                    <li>{formatQuota(plan.quotas.forms)} forms</li>
                    <li>
                      {formatQuota(plan.quotas.submissionsPerMonth)}{" "}
                      submissions/mo
                    </li>
                    <li>{formatQuota(plan.quotas.members)} team members</li>
                  </ul>
                  <Button
                    variant={plan.id === "pro" ? "primary" : "secondary"}
                    size="sm"
                    className="w-full mt-6"
                    asChild
                  >
                    <Link href="/signup">Get started</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="mt-8 text-center text-sm text-text-muted">
            Free plan available.{" "}
            <Link href="/pricing" className="underline hover:text-text-secondary">
              See full pricing →
            </Link>
          </p>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section
        aria-labelledby="faq-heading"
        className="border-b border-border bg-background py-24"
      >
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl">
            <h2
              id="faq-heading"
              className="text-3xl font-bold tracking-tight text-text-primary mb-12"
            >
              Frequently asked questions
            </h2>
            <dl className="flex flex-col gap-8">
              {FAQ_ITEMS.map((item) => (
                <div key={item.q}>
                  <dt className="text-base font-semibold text-text-primary">
                    {item.q}
                  </dt>
                  <dd className="mt-2 text-sm text-text-secondary leading-relaxed">
                    {item.a}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section
        aria-labelledby="cta-heading"
        className="bg-surface py-24"
      >
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2
              id="cta-heading"
              className="text-3xl font-bold tracking-tight text-text-primary sm:text-4xl"
            >
              Your next form should never fail silently.
            </h2>
            <p className="mt-4 text-base text-text-secondary">
              Set up your first endpoint in under three minutes. Free plan
              included — no credit card required.
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Button variant="primary" size="lg" asChild>
                <Link href="/signup">Create your endpoint</Link>
              </Button>
              <Button variant="ghost" size="lg" asChild>
                <Link href={brand.domains.docs}>Read the docs</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
