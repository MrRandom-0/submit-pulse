import { notFound } from "next/navigation";
import type { Actor } from "@submitpulse/auth/permissions";
import { can } from "@submitpulse/auth/permissions";
import { getForm, getFormNotificationSettings } from "@/lib/dashboard-data";
import { FormSubpageShell } from "@/components/forms/FormSubpageShell";
import { NotificationsEditor } from "@/components/forms/NotificationsEditor";

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

export default async function FormNotificationsPage({ params }: PageProps) {
  const { formId } = await params;
  const form = await getForm(formId);
  if (!form) notFound();

  const settings = await getFormNotificationSettings(formId);
  // Internal fields (e.g. the honeypot) are never valid Reply-To targets.
  const fieldNames = form.fields.filter((f) => !f.isInternal).map((f) => f.name);

  return (
    <FormSubpageShell
      form={form}
      section="Notifications"
      title="Email notifications"
      description="Choose who is emailed when this form receives a submission."
    >
      <NotificationsEditor
        initial={settings}
        fieldNames={fieldNames}
        canManage={can(FIXTURE_ACTOR, "email_destination:manage")}
      />
    </FormSubpageShell>
  );
}
