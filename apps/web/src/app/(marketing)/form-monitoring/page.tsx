import { Button, Badge, Card, CardContent, CardHeader, CardTitle, CardDescription } from "@submitpulse/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { brand } from "@submitpulse/config/brand";

export const metadata: Metadata = {
  title: `Form Monitoring — ${brand.name}`,
  description: `Pulse Monitor continuously tests your forms and alerts you the moment they stop working. Never lose a submission again.`,
};

export default function FormMonitoringPage() {
  return (
    <>
      <section aria-labelledby="monitor-heading" className="border-b border-border bg-background py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <Badge variant="success" className="mb-6">Pulse Monitor</Badge>
            <h1 id="monitor-heading" className="text-4xl font-bold tracking-tight text-text-primary sm:text-5xl">
              Know the moment a form breaks
            </h1>
            <p className="mt-6 text-lg text-text-secondary leading-relaxed">
              Synthetic health tests submit to your forms on a schedule. Incident
              alerts fire the moment a form stops accepting submissions — before
              any real user hits the problem.
            </p>
            <div className="mt-8 flex justify-center gap-3">
              <Button variant="primary" size="lg" asChild>
                <Link href="/signup">Enable monitoring</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="how-monitor-heading" className="border-b border-border bg-surface py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <h2 id="how-monitor-heading" className="text-2xl font-bold tracking-tight text-text-primary mb-10">
            How Pulse Monitor works
          </h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {[
              {
                n: "1",
                title: "Synthetic test submissions",
                body: "Marked test submissions are sent to your form endpoint on a configurable schedule. They are excluded from your inbox and delivery pipeline.",
              },
              {
                n: "2",
                title: "Failure detection",
                body: "If a test submission returns an error or times out, the monitor records a failure. After a configurable number of consecutive failures, an incident is opened.",
              },
              {
                n: "3",
                title: "Incident alerts",
                body: `You receive an alert via email or webhook immediately. The incident is visible in the ${brand.name} dashboard with timestamp and failure details.`,
              },
            ].map((step) => (
              <Card key={step.n}>
                <CardContent className="pt-6">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-sm font-semibold text-text-primary mb-4">
                    {step.n}
                  </span>
                  <h3 className="text-base font-semibold text-text-primary mb-2">{step.title}</h3>
                  <p className="text-sm text-text-secondary">{step.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="schema-drift-heading" className="border-b border-border bg-background py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <Badge variant="warning" className="mb-4">Schema Drift</Badge>
              <h2 id="schema-drift-heading" className="text-3xl font-bold tracking-tight text-text-primary">
                Catch field renames before integrations break
              </h2>
              <p className="mt-4 text-base text-text-secondary leading-relaxed">
                When an AI re-generates a form with different field names, your
                webhooks, autoresponders, and integrations silently break.
                Schema Drift detection compares incoming field sets to the
                baseline and alerts you to the diff.
              </p>
            </div>
            <div className="rounded-card border border-border bg-code-background p-6 font-mono">
              <pre className="overflow-x-auto text-xs text-text-secondary leading-relaxed">
                <code>{`// Schema drift alert
{
  "formId": "fm_...",
  "detectedAt": "2025-04-12T08:12:00Z",
  "baseline": ["full_name", "email", "message"],
  "received": ["name", "email", "body"],
  "removed": ["full_name", "message"],
  "added": ["name", "body"],
  "affectedWebhooks": 2,
  "affectedAutoresponders": 1,
  "repairPromptAvailable": true
}`}</code>
              </pre>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-surface py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-text-primary">
            Add monitoring to your forms today
          </h2>
          <p className="mt-4 text-base text-text-secondary">
            Pulse Monitor is included on Pro and Agency plans.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Button variant="primary" size="lg" asChild>
              <Link href="/signup">Start for free</Link>
            </Button>
            <Button variant="secondary" size="lg" asChild>
              <Link href="/pricing">View plans</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
