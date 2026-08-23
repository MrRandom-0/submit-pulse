import { Button, Badge, Card, CardContent, CardHeader, CardTitle, CardDescription } from "@submitpulse/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { brand } from "@submitpulse/config/brand";

export const metadata: Metadata = {
  title: `Spam Protection — ${brand.name}`,
  description: `Multi-layer server-side spam protection for your forms. No CAPTCHA friction. Block bots before submissions are stored.`,
};

export default function SpamProtectionPage() {
  return (
    <>
      <section aria-labelledby="spam-heading" className="border-b border-border bg-background py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <Badge variant="warning" className="mb-6">Spam Shield</Badge>
            <h1 id="spam-heading" className="text-4xl font-bold tracking-tight text-text-primary sm:text-5xl">
              Spam blocked before it reaches your inbox
            </h1>
            <p className="mt-6 text-lg text-text-secondary leading-relaxed">
              Multi-layer server-side filtering runs on every submission. No
              CAPTCHA required. Users don't know it's there.
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="layers-heading" className="border-b border-border bg-surface py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <h2 id="layers-heading" className="text-2xl font-bold tracking-tight text-text-primary mb-10">
            Defence layers
          </h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {[
              {
                title: "Honeypot fields",
                badge: "All plans" as const,
                body: "Hidden fields are injected into the form by the SDK. Real users never fill them. Bots do. Any submission with a honeypot value is immediately rejected.",
              },
              {
                title: "Submission velocity limits",
                badge: "All plans" as const,
                body: "Per-IP and per-form rate limits reject burst submissions from a single source. Configurable thresholds per form.",
              },
              {
                title: "Domain reputation scoring",
                badge: "Pro+" as const,
                body: "Email domains and referrer origins are scored against reputation databases. High-risk domains trigger rejection or quarantine.",
              },
              {
                title: "ML content classification",
                badge: "Pro+" as const,
                body: "Submission content is classified by a machine learning model trained on form spam patterns. Scores are stored with each submission and visible in the inbox.",
              },
            ].map((item) => (
              <Card key={item.title}>
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base">{item.title}</CardTitle>
                    <Badge variant="neutral" size="sm">{item.badge}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription>{item.body}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="spam-verdict-heading" className="border-b border-border bg-background py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <h2 id="spam-verdict-heading" className="text-3xl font-bold tracking-tight text-text-primary">
                Transparent verdicts on every submission
              </h2>
              <p className="mt-4 text-base text-text-secondary leading-relaxed">
                Every stored submission carries a spam score and verdict so you
                can inspect flagged submissions and tune thresholds. Quarantined
                submissions are held for review, not silently deleted.
              </p>
            </div>
            <div className="rounded-card border border-border bg-code-background p-6 font-mono">
              <pre className="overflow-x-auto text-xs text-text-secondary leading-relaxed">
                <code>{`{
  "id": "sub_01j...",
  "spam": {
    "score": 0.87,
    "verdict": "quarantined",
    "signals": [
      "domain_reputation_high_risk",
      "content_classification_spam",
      "velocity_limit_exceeded"
    ]
  }
}`}</code>
              </pre>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-surface py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-text-primary">
            Stop spam before it starts
          </h2>
          <div className="mt-8 flex justify-center gap-3">
            <Button variant="primary" size="lg" asChild>
              <Link href="/signup">Get started free</Link>
            </Button>
            <Button variant="secondary" size="lg" asChild>
              <Link href="/pricing">See plan limits</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
