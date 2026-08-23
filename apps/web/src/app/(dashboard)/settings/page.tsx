import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Label,
  Input,
  Field,
} from "@submitpulse/ui";
import type { Actor } from "@submitpulse/auth/permissions";
import { can } from "@submitpulse/auth/permissions";
import { PermissionGate } from "@/components/dashboard/PermissionGate";

const FIXTURE_ACTOR: Actor = {
  userId: "user-001",
  workspaceId: "ws-1",
  role: "admin",
};

export default function SettingsPage() {
  const actor = FIXTURE_ACTOR;
  const canUpdate = can(actor, "workspace:update");
  const canDelete = can(actor, "workspace:delete");
  const canConfigureRetention = can(actor, "data:configure_retention");
  const canExport = can(actor, "data:export_workspace");

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Settings</h1>
        <p className="text-sm text-text-muted mt-0.5">
          Workspace configuration
        </p>
      </div>

      {/* Workspace name */}
      <Card className="rounded-card shadow-card">
        <CardHeader>
          <CardTitle>Workspace</CardTitle>
          <CardDescription>Basic workspace settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field>
            <Label htmlFor="ws-name">Workspace name</Label>
            <Input
              id="ws-name"
              defaultValue="Acme Corp"
              disabled={!canUpdate}
              aria-describedby="ws-name-hint"
            />
            <p id="ws-name-hint" className="text-xs text-text-muted mt-1">
              Shown in the workspace selector and email notifications.
            </p>
          </Field>
          {canUpdate && (
            <Button variant="primary" size="sm">Save changes</Button>
          )}
        </CardContent>
      </Card>

      {/* Data retention */}
      <Card className="rounded-card shadow-card">
        <CardHeader>
          <CardTitle>Data retention</CardTitle>
          <CardDescription>
            How long submission data is kept before automatic deletion
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-text-secondary">
            Retention is controlled per-form and falls back to the plan default.
            Configure individual form retention from each form&rsquo;s settings tab.
          </p>
          {canConfigureRetention && (
            <Button variant="secondary" size="sm">Configure retention</Button>
          )}
        </CardContent>
      </Card>

      {/* Export */}
      {canExport && (
        <Card className="rounded-card shadow-card">
          <CardHeader>
            <CardTitle>Export workspace data</CardTitle>
            <CardDescription>
              Export all submissions and form configuration as a ZIP archive
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="secondary" size="sm">Request export</Button>
          </CardContent>
        </Card>
      )}

      {/* Danger zone */}
      {canDelete && (
        <Card className="rounded-card shadow-card border-danger">
          <CardHeader>
            <CardTitle className="text-danger">Danger zone</CardTitle>
            <CardDescription>
              Irreversible actions — proceed with caution
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-text-primary">Delete workspace</p>
                <p className="text-xs text-text-muted">
                  Permanently deletes this workspace, all forms, and all submissions.
                </p>
              </div>
              <Button variant="danger" size="sm">Delete workspace</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
