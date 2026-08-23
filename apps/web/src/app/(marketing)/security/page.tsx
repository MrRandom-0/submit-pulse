import { Button, Badge, Card, CardContent, CardHeader, CardTitle, CardDescription } from "@submitpulse/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { brand } from "@submitpulse/config/brand";

export const metadata: Metadata = {
  title: `Security — ${brand.name}`,
  description: `How ${brand.name} secures your form data. Domain allowlists, signed webhooks, TLS, GDPR compliance, and responsible disclosure.`,
};

export default function SecurityPage() {
  return (
    <>
      <section aria-labelledby="security-heading" className="border-b border-border bg-background py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <Badge variant="success" className="mb-6">Security</Badge>
            <h1 id="security-heading" className="text-4xl font-bold tracking-tight text-text-primary sm:text-5xl">
              Built for public form endpoints
            </h1>
            <p className="mt-6 text-lg text-text-secondary leading-relaxed">
              Form endpoints are public by design — a contact form receives
              submissions from anyone. Security comes from domain rules, rate
              limiting, signed webhooks, and data isolation — not from hiding
              the URL.
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="security-principles-heading" className="border-b border-border bg-surface py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <h2 id="security-principles-heading" className="text-2xl font-bold tracking-tight text-text-primary mb-10">
            Security model
          </h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                title: "Domain allowlists",
                body: "Restrict form endpoints to specific origins. Submissions from unlisted domains are rejected with a 403 before any processing occurs.",
              },
              {
                title: "TLS-only",
                body: `The ${brand.name} API is HTTPS-only. HSTS with a long max-age is enforced. HTTP connections are not accepted.`,
              },
              {
                title: "Signed webhooks",
                body: `Outbound webhooks carry HMAC-SHA256 signatures in the ${brand.wire.signatureHeader} header. Verify on your server.`,
              },
              {
                title: "Rate limiting",
                body: "Every endpoint is rate limited at the IP, form, and workspace level. Abuse is blocked before it affects other customers.",
              },
              {
                title: "Data isolation",
                body: "Submission data is isolated per workspace. Row-level security enforces workspace boundaries at the database layer.",
              },
              {
                title: "Hashed credentials",
                body: "API keys are stored as bcrypt hashes. The plaintext key is shown once at creation and never retrievable.",
              },
              {
                title: "Audit log",
                body: "Every authenticated action — form created, webhook added, API key issued — is recorded in an append-only audit log.",
              },
              {
                title: "GDPR ready",
                body: "Data is stored in your configured region. Submission deletion is immediate and cascades to associated files. Data export is available on request.",
              },
              {
                title: "Responsible disclosure",
                body: `Report vulnerabilities to ${brand.email.security}. We acknowledge within 24 hours and aim to patch within 14 days.`,
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

      <section aria-labelledby="form-id-heading" className="border-b border-border bg-background py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl">
            <h2 id="form-id-heading" className="text-2xl font-bold tracking-tight text-text-primary mb-4">
              Form IDs are public, not secret
            </h2>
            <p className="text-base text-text-secondary leading-relaxed">
              A form endpoint receives submissions from anyone who fills in the
              form. The form ID (
              <code className="text-xs bg-code-background px-1.5 py-0.5 rounded font-mono">
                {brand.identifiers.form}_...
              </code>
              ) is intentionally public — it is in the source of every page
              that embeds the form. Treating it as a secret creates a false
              sense of security.
            </p>
            <p className="mt-4 text-base text-text-secondary leading-relaxed">
              Access control is implemented via domain allowlists and rate
              limits, not ID secrecy. This is documented explicitly so no
              security audit is surprised by it.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-surface py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-text-primary">
            Questions about security?
          </h2>
          <p className="mt-4 text-base text-text-secondary">
            Contact us at{" "}
            <a href={`mailto:${brand.email.security}`} className="underline hover:text-text-primary">
              {brand.email.security}
            </a>
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Button variant="primary" size="lg" asChild>
              <Link href="/contact">Contact us</Link>
            </Button>
            <Button variant="secondary" size="lg" asChild>
              <Link href="/privacy">Privacy policy</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
