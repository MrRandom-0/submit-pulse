import { notFound } from "next/navigation";
import type { Actor } from "@submitpulse/auth/permissions";
import { can } from "@submitpulse/auth/permissions";
import { getForm } from "@/lib/dashboard-data";
import { FormSubpageShell } from "@/components/forms/FormSubpageShell";
import { SettingsEditor } from "@/components/forms/SettingsEditor";

// ---------------------------------------------------------------------------
// Fixture actor — replace with real session lookup
// ---------------------------------------------------------------------------
const FIXTURE_ACTOR: Actor = {
  userId: "user-001",
  workspaceId: "ws-1",
  role: "admin",
};

interface PageProps {
  params: Promise<{ formId: string }>;
}

export default async function FormSettingsPage({ params }: PageProps) {
  const { formId } = await params;
  const form = await getForm(formId);
  if (!form) notFound();

  return (
    <FormSubpageShell
      form={form}
      section="Settings"
      title="Form settings"
      description="General configuration for this form."
    >
      <SettingsEditor
        form={form}
        canUpdate={can(FIXTURE_ACTOR, "form:update")}
        canDelete={can(FIXTURE_ACTOR, "form:delete")}
      />
    </FormSubpageShell>
  );
}
