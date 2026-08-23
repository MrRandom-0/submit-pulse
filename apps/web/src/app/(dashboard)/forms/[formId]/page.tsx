import { notFound } from "next/navigation";
import Link from "next/link";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Badge,
  StatusDot,
  Button,
  CodeBlock,
  EmptyState,
} from "@submitpulse/ui";
import { brand, formEndpoint } from "@submitpulse/config";
import { getForm } from "@/lib/dashboard-data";
import { CopyEndpoint } from "@/components/dashboard/CopyEndpoint";
import type { Actor } from "@submitpulse/auth/permissions";
import { can } from "@submitpulse/auth/permissions";
import { PermissionGate } from "@/components/dashboard/PermissionGate";
import type { FormDetail } from "@/lib/dashboard-data";

// ---------------------------------------------------------------------------
// Fixture actor — replace with real session lookup
// ---------------------------------------------------------------------------
const FIXTURE_ACTOR: Actor = {
  userId: "user-001",
  workspaceId: "ws-1",
  role: "admin",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1_024) return `${(bytes / 1_024).toFixed(0)} KB`;
  return `${bytes} B`;
}

// ---------------------------------------------------------------------------
// Integration tab content (server component)
// ---------------------------------------------------------------------------

function IntegrationTab({ form, endpoint }: { form: FormDetail; endpoint: string }) {
  const htmlSnippet = `<form action="${endpoint}" method="POST">
  <input name="name" type="text" required placeholder="Your name" />
  <input name="email" type="email" required placeholder="Your email" />
  <textarea name="message" required placeholder="Your message"></textarea>
  <button type="submit">Send</button>
</form>`;

  const fetchSnippet = `await fetch("${endpoint}", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    name: "Alice Johnson",
    email: "alice@example.com",
    message: "Hello!",
  }),
});`;

  const aiPrompt = `You are integrating a form with ${brand.name}. The form submission endpoint is:

${endpoint}

Send a POST request with the form fields as JSON. The API returns {"ok":true,"submissionId":"sub_..."} on success. Add error handling for 4xx and 5xx responses.

Form fields: ${form.fields.filter((f) => !f.isInternal).map((f) => f.name).join(", ")}`;

  return (
    <div className="space-y-6">
      <Card className="rounded-card">
        <CardHeader>
          <CardTitle>Endpoint URL</CardTitle>
          <CardDescription>
            This is the public URL where your form should POST submissions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CopyEndpoint endpoint={endpoint} />
        </CardContent>
      </Card>

      <Card className="rounded-card">
        <CardHeader>
          <CardTitle>HTML form</CardTitle>
          <CardDescription>
            Point your HTML form action attribute at the endpoint.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CodeBlock
            code={htmlSnippet}
            language="html"
            copyable
            caption="HTML form integration"
          />
        </CardContent>
      </Card>

      <Card className="rounded-card">
        <CardHeader>
          <CardTitle>JavaScript / fetch</CardTitle>
          <CardDescription>
            Submit programmatically via the Fetch API.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CodeBlock
            code={fetchSnippet}
            language="javascript"
            copyable
            caption="fetch() integration"
          />
        </CardContent>
      </Card>

      <Card className="rounded-card">
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle>AI coding prompt</CardTitle>
              <CardDescription>
                Paste this into Cursor, Copilot, or any AI coding assistant to generate
                the integration automatically.
              </CardDescription>
            </div>
            <Badge variant="info">AI-ready</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <CodeBlock
            code={aiPrompt}
            language="text"
            copyable
            caption="Copy into your AI coding assistant"
          />
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fields tab
// ---------------------------------------------------------------------------

function FieldsTab({ form, actor }: { form: FormDetail; actor: Actor }) {
  const canUpdate = can(actor, "form:update");
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-text-secondary">
          {form.fields.length} field{form.fields.length !== 1 ? "s" : ""} defined
        </p>
        {canUpdate && (
          <Button variant="secondary" size="sm" asChild>
            <Link href={`/forms/${form.id}/fields/edit`}>Edit fields</Link>
          </Button>
        )}
      </div>
      {form.fields.length === 0 ? (
        <EmptyState title="No fields defined" description="Add fields to enable schema validation and drift detection." />
      ) : (
        <div className="rounded-card border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface">
              <tr>
                <th scope="col" className="px-4 py-3 text-left font-medium text-text-secondary">
                  Field name
                </th>
                <th scope="col" className="px-4 py-3 text-left font-medium text-text-secondary">
                  Type
                </th>
                <th scope="col" className="px-4 py-3 text-left font-medium text-text-secondary">
                  Required
                </th>
                <th scope="col" className="px-4 py-3 text-left font-medium text-text-secondary">
                  Flags
                </th>
              </tr>
            </thead>
            <tbody>
              {form.fields.map((field) => (
                <tr key={field.id} className="border-t border-border">
                  <td className="px-4 py-3 font-mono text-xs text-text-primary">
                    {field.name}
                    {field.label && field.label !== field.name && (
                      <span className="ml-2 text-text-muted font-sans">{field.label}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{field.type}</td>
                  <td className="px-4 py-3">
                    {field.required ? (
                      <Badge variant="info">Required</Badge>
                    ) : (
                      <span className="text-text-muted">Optional</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {field.isInternal && <Badge variant="warning">Internal</Badge>}
                      {field.isSensitive && <Badge variant="danger">Sensitive</Badge>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Domains tab
// ---------------------------------------------------------------------------

function DomainsTab({ form, actor }: { form: FormDetail; actor: Actor }) {
  const canUpdate = can(actor, "form:update");
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm text-text-secondary">
            {form.enforceOrigin
              ? "Origin enforcement is active — only listed domains may submit."
              : "Origin enforcement is disabled — any origin may submit."}
          </p>
          {form.allowLocalhost && (
            <p className="text-xs text-text-muted mt-0.5">Localhost allowed for development</p>
          )}
        </div>
        {canUpdate && (
          <Button variant="secondary" size="sm" asChild>
            <Link href={`/forms/${form.id}/domains`}>Manage domains</Link>
          </Button>
        )}
      </div>
      {form.domains.length === 0 ? (
        <EmptyState title="No domains configured" description="Add allowed origin domains to restrict form access." />
      ) : (
        <div className="rounded-card border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface">
              <tr>
                <th scope="col" className="px-4 py-3 text-left font-medium text-text-secondary">Host</th>
                <th scope="col" className="px-4 py-3 text-left font-medium text-text-secondary">Subdomains</th>
                <th scope="col" className="px-4 py-3 text-left font-medium text-text-secondary">Type</th>
                <th scope="col" className="px-4 py-3 text-left font-medium text-text-secondary">Note</th>
              </tr>
            </thead>
            <tbody>
              {form.domains.map((d) => (
                <tr key={d.id} className="border-t border-border">
                  <td className="px-4 py-3 font-mono text-xs text-text-primary">{d.host}</td>
                  <td className="px-4 py-3">
                    {d.includeSubdomains ? <Badge variant="info">Included</Badge> : "No"}
                  </td>
                  <td className="px-4 py-3">
                    {d.isPreviewDomain ? <Badge variant="warning">Preview</Badge> : <Badge variant="success">Production</Badge>}
                  </td>
                  <td className="px-4 py-3 text-text-muted">{d.note ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Notifications tab (stub)
// ---------------------------------------------------------------------------

function NotificationsTab({ form, actor }: { form: FormDetail; actor: Actor }) {
  const canManage = can(actor, "email_destination:manage");
  return (
    <div className="space-y-4">
      <Card className="rounded-card">
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle>Email notifications</CardTitle>
            <CardDescription>Notify on every new submission</CardDescription>
          </div>
          {canManage && (
            <Button variant="secondary" size="sm" asChild>
              <Link href={`/forms/${form.id}/notifications`}>Configure</Link>
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <p className="text-sm text-text-muted">
            Notification configuration is managed in the dedicated settings page.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Spam tab (stub)
// ---------------------------------------------------------------------------

function SpamTab({ form, actor }: { form: FormDetail; actor: Actor }) {
  const canManage = can(actor, "health:manage");
  return (
    <div className="space-y-4">
      <Card className="rounded-card">
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle>Spam protection</CardTitle>
            <CardDescription>
              {form.spamBlockedCount.toLocaleString("en-US")} submissions blocked
            </CardDescription>
          </div>
          {canManage && (
            <Button variant="secondary" size="sm" asChild>
              <Link href={`/forms/${form.id}/spam`}>Manage rules</Link>
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-text-secondary">
          <div className="flex justify-between">
            <span>CAPTCHA</span>
            <Badge variant={form.captchaEnabled ? "success" : "neutral"}>
              {form.captchaEnabled ? "Enabled" : "Disabled"}
            </Badge>
          </div>
          <div className="flex justify-between">
            <span>Honeypot field</span>
            <Badge variant={form.honeypotFieldName ? "success" : "neutral"}>
              {form.honeypotFieldName ? form.honeypotFieldName : "None"}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Settings tab (stub)
// ---------------------------------------------------------------------------

function SettingsTab({ form, actor }: { form: FormDetail; actor: Actor }) {
  const canUpdate = can(actor, "form:update");
  return (
    <div className="space-y-4">
      <Card className="rounded-card">
        <CardHeader>
          <CardTitle>Form settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-text-secondary">Success redirect URL</span>
            <span className="text-text-primary font-mono text-xs truncate max-w-[200px]">
              {form.successRedirectUrl ?? "Not configured"}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-text-secondary">Max body size</span>
            <span className="text-text-primary">{formatBytes(form.maxBodyBytes)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-text-secondary">File uploads</span>
            <Badge variant={form.fileUploadsEnabled ? "success" : "neutral"}>
              {form.fileUploadsEnabled ? "Enabled" : "Disabled"}
            </Badge>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-text-secondary">Retention override</span>
            <span className="text-text-primary">
              {form.retentionDaysOverride ? `${form.retentionDaysOverride} days` : "Plan default"}
            </span>
          </div>
          {canUpdate && (
            <div className="pt-2">
              <Button variant="secondary" size="sm" asChild>
                <Link href={`/forms/${form.id}/settings`}>Edit settings</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

interface PageProps {
  params: Promise<{ formId: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export default async function FormDetailPage({ params, searchParams }: PageProps) {
  const { formId } = await params;
  const { tab: activeTab = "overview" } = await searchParams;

  const form = await getForm(formId);
  if (!form) notFound();

  const actor = FIXTURE_ACTOR;
  const endpoint = formEndpoint(form.publicId);

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0 flex-1">
          <nav aria-label="Breadcrumb" className="mb-2">
            <ol className="flex items-center gap-1.5 text-sm text-text-muted">
              <li><Link href="/forms" className="hover:text-text-primary">Forms</Link></li>
              <li aria-hidden>/</li>
              <li className="text-text-primary font-medium truncate">{form.name}</li>
            </ol>
          </nav>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-text-primary">{form.name}</h1>
            <StatusDot status={form.healthStatus} showLabel />
            <Badge variant={form.status === "active" ? "success" : form.status === "paused" ? "warning" : "neutral"}>
              {form.status}
            </Badge>
          </div>
          {form.websiteUrl && (
            <a
              href={form.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-text-muted hover:text-primary mt-1 block"
            >
              {form.websiteUrl}
            </a>
          )}
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <PermissionGate actor={actor} permission="form:test">
            <Button variant="secondary" size="sm">Test form</Button>
          </PermissionGate>
          <Button variant="primary" size="sm" asChild>
            <Link href={`/submissions?formId=${form.id}`}>View submissions</Link>
          </Button>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center">
          <div className="text-xl font-bold text-text-primary tabular-nums">
            {form.submissionCount.toLocaleString("en-US")}
          </div>
          <div className="text-xs text-text-muted">Submissions</div>
        </div>
        <div className="text-center border-x border-border">
          <div className="text-xl font-bold text-text-primary tabular-nums">
            {form.spamBlockedCount.toLocaleString("en-US")}
          </div>
          <div className="text-xs text-text-muted">Spam blocked</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-bold text-text-primary">
            {form.lastSubmissionAt
              ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(form.lastSubmissionAt)
              : "Never"}
          </div>
          <div className="text-xs text-text-muted">Last submission</div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue={activeTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="fields">Fields</TabsTrigger>
          <TabsTrigger value="integration">Integration</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="spam">Spam</TabsTrigger>
          <TabsTrigger value="domains">Domains</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* Overview tab */}
        <TabsContent value="overview" className="mt-6">
          <div className="grid sm:grid-cols-2 gap-6">
            <Card className="rounded-card">
              <CardHeader>
                <CardTitle>Form details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-text-secondary">Public ID</span>
                  <code className="text-xs text-text-primary font-mono">{form.publicId}</code>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Created</span>
                  <span className="text-text-primary">
                    {new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(form.createdAt)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Updated</span>
                  <span className="text-text-primary">
                    {new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(form.updatedAt)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Origin enforcement</span>
                  <Badge variant={form.enforceOrigin ? "success" : "warning"}>
                    {form.enforceOrigin ? "On" : "Off"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
            <Card className="rounded-card">
              <CardHeader>
                <CardTitle>Endpoint</CardTitle>
                <CardDescription>Your form posts to this URL</CardDescription>
              </CardHeader>
              <CardContent>
                <CopyEndpoint endpoint={endpoint} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="fields" className="mt-6">
          <FieldsTab form={form} actor={actor} />
        </TabsContent>

        <TabsContent value="integration" className="mt-6">
          <IntegrationTab form={form} endpoint={endpoint} />
        </TabsContent>

        <TabsContent value="notifications" className="mt-6">
          <NotificationsTab form={form} actor={actor} />
        </TabsContent>

        <TabsContent value="spam" className="mt-6">
          <SpamTab form={form} actor={actor} />
        </TabsContent>

        <TabsContent value="domains" className="mt-6">
          <DomainsTab form={form} actor={actor} />
        </TabsContent>

        <TabsContent value="settings" className="mt-6">
          <SettingsTab form={form} actor={actor} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
