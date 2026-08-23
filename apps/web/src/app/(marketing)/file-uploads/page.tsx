import { Button, Badge, Card, CardContent, CardHeader, CardTitle, CardDescription } from "@submitpulse/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { brand } from "@submitpulse/config/brand";
import { PLANS, formatQuota } from "@submitpulse/config/entitlements";

export const metadata: Metadata = {
  title: `File Uploads — ${brand.name}`,
  description: `Accept file attachments in your forms. ${brand.name} stores files in isolated storage and delivers signed download links.`,
};

const proPlan = PLANS.pro;
const agencyPlan = PLANS.agency;

export default function FileUploadsPage() {
  return (
    <>
      <section aria-labelledby="uploads-heading" className="border-b border-border bg-background py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <Badge variant="neutral" className="mb-6">File Uploads</Badge>
            <h1 id="uploads-heading" className="text-4xl font-bold tracking-tight text-text-primary sm:text-5xl">
              Accept files in any form
            </h1>
            <p className="mt-6 text-lg text-text-secondary leading-relaxed">
              {brand.name} accepts multipart form submissions with file
              attachments. Files are stored in isolated, signed storage. Your
              webhook and inbox receive signed download URLs — not raw file
              data.
            </p>
            <div className="mt-8">
              <Button variant="primary" size="lg" asChild>
                <Link href="/signup">Get started</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="uploads-features-heading" className="border-b border-border bg-surface py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <h2 id="uploads-features-heading" className="text-2xl font-bold tracking-tight text-text-primary mb-10">
            How file uploads work
          </h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                title: "Multipart form support",
                body: "Set enctype=\"multipart/form-data\" on your form. The SDK handles the rest — no special client code required.",
              },
              {
                title: "Isolated storage",
                body: "Uploaded files are stored in isolated per-workspace storage. Files from one workspace are never accessible by another.",
              },
              {
                title: "Signed download URLs",
                body: "Webhooks and the inbox receive time-limited signed URLs to download files. Raw file bytes are never sent over webhook.",
              },
              {
                title: "Type and size validation",
                body: "Configure allowed MIME types and maximum file sizes per form. Oversized or disallowed files are rejected with a descriptive error.",
              },
              {
                title: "Retention policy",
                body: "Files follow the same retention policy as submissions. Deleted submissions clean up associated files.",
              },
              {
                title: "No infrastructure required",
                body: "No S3 bucket, no Lambda, no CDN to configure. File storage is included in the plan quota.",
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

      <section aria-labelledby="uploads-code-heading" className="border-b border-border bg-background py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-3xl">
            <h2 id="uploads-code-heading" className="text-2xl font-bold tracking-tight text-text-primary mb-6">
              Implementation
            </h2>
            <div className="rounded-card border border-border bg-code-background p-6 font-mono">
              <pre className="overflow-x-auto text-xs text-text-secondary leading-relaxed">
                <code>{`<!-- HTML form with file upload -->
<form
  action="${brand.domains.api}/v1/forms/fm_xxx/submissions"
  method="POST"
  enctype="multipart/form-data"
>
  <input name="name" type="text" required />
  <input name="email" type="email" required />
  <input name="attachment" type="file" accept=".pdf,.png,.jpg" />
  <button type="submit">Submit</button>
</form>

<!-- Submission received by webhook -->
{
  "fields": { "name": "Alex", "email": "..." },
  "files": {
    "attachment": {
      "filename": "document.pdf",
      "size": 245120,
      "mimeType": "application/pdf",
      "url": "https://files.${brand.domains.apex}/...?sig=..."
    }
  }
}`}</code>
              </pre>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="uploads-storage-heading" className="border-b border-border bg-surface py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <h2 id="uploads-storage-heading" className="text-2xl font-bold tracking-tight text-text-primary text-center mb-10">
            Storage by plan
          </h2>
          <div className="mx-auto max-w-md">
            <div className="rounded-card border border-border overflow-hidden">
              {[
                { name: "Free", storage: "Not available" },
                { name: "Starter", storage: "Not available" },
                { name: "Pro", storage: `${formatQuota(proPlan.quotas.fileStorageMb)} MB` },
                { name: "Agency", storage: `${formatQuota(agencyPlan.quotas.fileStorageMb)} MB` },
              ].map((row, i) => (
                <div key={row.name} className={`flex justify-between px-6 py-4 ${i > 0 ? "border-t border-border" : ""}`}>
                  <span className="text-sm text-text-secondary">{row.name}</span>
                  <span className="text-sm font-medium text-text-primary">{row.storage}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-background py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-text-primary">
            Start accepting file uploads today
          </h2>
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
