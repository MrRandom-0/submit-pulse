import { notFound } from "next/navigation";
import type { Actor } from "@submitpulse/auth/permissions";
import { can } from "@submitpulse/auth/permissions";
import { getForm, getFormSpamSettings } from "@/lib/dashboard-data";
import { FormSubpageShell } from "@/components/forms/FormSubpageShell";
import { SpamEditor } from "@/components/forms/SpamEditor";

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

export default async function FormSpamPage({ params }: PageProps) {
  const { formId } = await params;
  const form = await getForm(formId);
  if (!form) notFound();

  const settings = await getFormSpamSettings(formId);

  return (
    <FormSubpageShell
      form={form}
      section="Spam"
      title="Spam protection"
      description={`${form.spamBlockedCount.toLocaleString("en-US")} submissions blocked so far. Tune how this form filters the rest.`}
    >
      <SpamEditor
        initial={settings}
        initialCaptchaEnabled={form.captchaEnabled}
        initialHoneypotFieldName={form.honeypotFieldName}
        fieldNames={form.fields.map((f) => f.name)}
        canManage={can(FIXTURE_ACTOR, "health:manage")}
      />
    </FormSubpageShell>
  );
}
