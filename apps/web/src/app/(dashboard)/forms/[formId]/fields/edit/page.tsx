import { notFound } from "next/navigation";
import type { Actor } from "@submitpulse/auth/permissions";
import { can } from "@submitpulse/auth/permissions";
import { getForm } from "@/lib/dashboard-data";
import { FormSubpageShell } from "@/components/forms/FormSubpageShell";
import { FieldsEditor } from "@/components/forms/FieldsEditor";

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

export default async function EditFieldsPage({ params }: PageProps) {
  const { formId } = await params;
  const form = await getForm(formId);
  if (!form) notFound();

  return (
    <FormSubpageShell
      form={form}
      section="Fields"
      title="Edit fields"
      description="Submissions are validated against this field list, and schema drift is detected when a payload no longer matches it."
    >
      <FieldsEditor
        initialFields={form.fields}
        canUpdate={can(FIXTURE_ACTOR, "form:update")}
      />
    </FormSubpageShell>
  );
}
