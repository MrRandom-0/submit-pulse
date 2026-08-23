/**
 * Agency Mode dashboard.
 *
 * Gated on clientWorkspaces + agencyDashboard entitlements.
 * Uses canUseFeature from @submitpulse/config — if the current plan lacks
 * these features, an upgrade prompt is shown instead of the dashboard.
 *
 * Workspace kind/parentWorkspaceId model comes from packages/database/src/schema/identity.ts.
 */

import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Badge,
  Button,
  EmptyState,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@submitpulse/ui";
import {
  canUseFeature,
  type EntitlementContext,
} from "@submitpulse/config/entitlements";
import {
  getAgencyOverview,
  listClientWorkspaces,
  listFormTemplates,
} from "@/lib/scanner-data";
import { ClientHealthCard } from "@/components/agency/ClientHealthCard";
import { AgencyBrandingPanel } from "@/components/agency/AgencyBrandingPanel";
import { WhiteLabelReportPreview } from "@/components/agency/WhiteLabelReportPreview";

export const metadata = {
  title: "Agency — SubmitPulse",
  description: "Consolidated multi-client form health dashboard.",
};

// ---------------------------------------------------------------------------
// Simulated entitlement context — replace with real plan from session/auth.
// ---------------------------------------------------------------------------
const FIXTURE_ENTITLEMENT_CTX: EntitlementContext = {
  plan: "agency",
  usage: {},
};

// ---------------------------------------------------------------------------
// Upgrade prompt
// ---------------------------------------------------------------------------

function UpgradePrompt() {
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-2xl mx-auto">
      <EmptyState
        icon={
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
            <path
              d="M10 2L12.5 7.5H18L13.5 11.5L15 17L10 13.5L5 17L6.5 11.5L2 7.5H7.5L10 2Z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
        }
        title="Agency Mode requires the Agency plan"
        description={
          "Consolidated multi-client dashboards, form templates, per-client usage " +
          "reporting, and white-label branding are available on the Agency plan."
        }
        action={
          <Button variant="primary" size="sm" asChild>
            <Link href="/billing">Upgrade to Agency</Link>
          </Button>
        }
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function AgencyPage() {
  // ---- Entitlement gate ----
  const clientWsVerdict = canUseFeature(FIXTURE_ENTITLEMENT_CTX, "clientWorkspaces");
  const agencyDashVerdict = canUseFeature(FIXTURE_ENTITLEMENT_CTX, "agencyDashboard");

  if (!clientWsVerdict.allowed || !agencyDashVerdict.allowed) {
    return <UpgradePrompt />;
  }

  // ---- Data ----
  const [overview, clients, templates] = await Promise.all([
    getAgencyOverview(),
    listClientWorkspaces(),
    listFormTemplates(),
  ]);

  const agencyBranding = {
    logoUrl: "",
    accentColor: "#4f46e5",
    replyToEmail: "",
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Agency</h1>
          <p className="text-sm text-text-muted mt-0.5">
            Multi-client form health dashboard · {overview.totalClients} client workspaces
          </p>
        </div>
        <Button variant="secondary" size="sm" asChild>
          <Link href="/agency/clients/new">Add client workspace</Link>
        </Button>
      </div>

      {/* Aggregate overview row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(
          [
            { label: "Clients", value: overview.totalClients },
            { label: "Total forms", value: overview.totalForms },
            {
              label: "Submissions this month",
              value: overview.totalSubmissionsThisMonth.toLocaleString("en-US"),
            },
            {
              label: "Clients with issues",
              value: overview.clientsWithIssues,
              accent: overview.clientsWithIssues > 0 ? ("warning" as const) : undefined,
            },
          ] as const
        ).map(({ label, value, accent }) => (
          <Card key={label} className="rounded-card shadow-card">
            <CardContent className="pt-4 pb-3">
              <div className="text-2xl font-bold text-text-primary tabular-nums">
                {value}
              </div>
              <p className="text-xs text-text-muted mt-0.5 flex items-center gap-1.5">
                {accent !== undefined && (
                  <span aria-hidden className="text-warning">⚠</span>
                )}
                {label}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabbed sections */}
      <Tabs defaultValue="clients">
        <TabsList>
          <TabsTrigger value="clients">
            Clients
            <Badge variant="neutral" size="sm" className="ml-1.5">{clients.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="templates">Form templates</TabsTrigger>
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="report">Report preview</TabsTrigger>
        </TabsList>

        {/* Clients tab */}
        <TabsContent value="clients" className="mt-4 space-y-3">
          {clients.length === 0 ? (
            <EmptyState
              title="No client workspaces yet"
              description="Add a client workspace to start managing their forms from this agency dashboard."
              action={
                <Button variant="primary" size="sm" asChild>
                  <Link href="/agency/clients/new">Add client</Link>
                </Button>
              }
            />
          ) : (
            clients.map((client) => (
              <ClientHealthCard key={client.id} client={client} />
            ))
          )}
        </TabsContent>

        {/* Form templates tab */}
        <TabsContent value="templates" className="mt-4">
          <Card className="rounded-card shadow-card">
            <CardHeader>
              <CardTitle>Reusable form templates</CardTitle>
              <CardDescription>
                Deploy a template to any client workspace with one click. Templates
                are pre-configured field schemas — clients can customise them after deployment.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {templates.length === 0 ? (
                <EmptyState
                  title="No templates yet"
                  description="Create a reusable form template to deploy across client workspaces."
                />
              ) : (
                <div className="space-y-3">
                  {templates.map((tpl) => (
                    <div
                      key={tpl.id}
                      className="flex items-center gap-4 p-3 rounded-md border border-border hover:bg-background transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm text-text-primary">
                            {tpl.name}
                          </span>
                          <Badge variant="neutral" size="sm">{tpl.category}</Badge>
                          <Badge variant="neutral" size="sm">{tpl.fieldCount} fields</Badge>
                        </div>
                        <p className="text-xs text-text-muted mt-0.5">{tpl.description}</p>
                      </div>
                      <div className="shrink-0 text-xs text-text-muted">
                        Used by {tpl.usedByClientCount} client{tpl.usedByClientCount !== 1 ? "s" : ""}
                      </div>
                      <Button variant="secondary" size="sm">
                        Deploy
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Branding tab */}
        <TabsContent value="branding" className="mt-4">
          <AgencyBrandingPanel initial={agencyBranding} />
        </TabsContent>

        {/* Report preview tab */}
        <TabsContent value="report" className="mt-4">
          <WhiteLabelReportPreview
            clients={clients}
            agencyName="Your Agency"
            accentColor={agencyBranding.accentColor}
            logoUrl={agencyBranding.logoUrl !== "" ? agencyBranding.logoUrl : undefined}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
