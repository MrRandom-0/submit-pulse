import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Badge,
  Button,
} from "@submitpulse/ui";
import type { Actor } from "@submitpulse/auth/permissions";
import { can } from "@submitpulse/auth/permissions";
import { brand } from "@submitpulse/config";
import { PermissionGate } from "@/components/dashboard/PermissionGate";

const FIXTURE_ACTOR: Actor = {
  userId: "user-001",
  workspaceId: "ws-1",
  role: "admin",
};

const INTEGRATIONS = [
  { id: "zapier", name: "Zapier", description: "Connect forms to 6,000+ apps via Zapier.", connected: false, logo: "Z" },
  { id: "slack", name: "Slack", description: "Post new submissions to a Slack channel.", connected: true, logo: "S" },
  { id: "notion", name: "Notion", description: "Add submissions to a Notion database.", connected: false, logo: "N" },
  { id: "airtable", name: "Airtable", description: "Sync submissions into an Airtable base.", connected: false, logo: "A" },
  { id: "webhook", name: "Custom webhook", description: "POST submission data to any URL.", connected: false, logo: "W" },
  { id: "mcp", name: "MCP server", description: "Connect AI coding agents via the Model Context Protocol.", connected: false, logo: "AI" },
];

export default function IntegrationsPage() {
  const actor = FIXTURE_ACTOR;
  const canManage = can(actor, "integration:manage");

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Integrations</h1>
        <p className="text-sm text-text-muted mt-0.5">
          Connect {brand.name} to your existing tools
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {INTEGRATIONS.map((integration) => (
          <Card key={integration.id} className="rounded-card shadow-card">
            <CardHeader className="flex flex-row items-start gap-3 pb-2">
              <div className="h-10 w-10 rounded-md bg-primary/10 text-primary font-bold text-sm flex items-center justify-center flex-shrink-0">
                {integration.logo}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base">{integration.name}</CardTitle>
                  {integration.connected && (
                    <Badge variant="success">Connected</Badge>
                  )}
                </div>
                <CardDescription>{integration.description}</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <PermissionGate actor={actor} permission="integration:manage" fallback={
                <Button variant="secondary" size="sm" disabled>Manage</Button>
              }>
                <Button variant={integration.connected ? "secondary" : "primary"} size="sm">
                  {integration.connected ? "Configure" : "Connect"}
                </Button>
              </PermissionGate>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
