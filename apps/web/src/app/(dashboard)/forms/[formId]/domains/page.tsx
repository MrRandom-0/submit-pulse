import { notFound } from "next/navigation";
import type { Actor } from "@submitpulse/auth/permissions";
import { can } from "@submitpulse/auth/permissions";
import { getForm } from "@/lib/dashboard-data";
import { FormSubpageShell } from "@/components/forms/FormSubpageShell";
import { DomainsEditor } from "@/components/forms/DomainsEditor";

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

export default async function FormDomainsPage({ params }: PageProps) {
  const { formId } = await params;
  const form = await getForm(formId);
  if (!form) notFound();

  return (
    <FormSubpageShell
      form={form}
      section="Domains"
      title="Allowed domains"
      description="Control which websites may submit to this form."
    >
      <DomainsEditor
        initialDomains={form.domains}
        initialEnforceOrigin={form.enforceOrigin}
        initialAllowLocalhost={form.allowLocalhost}
        canUpdate={can(FIXTURE_ACTOR, "form:update")}
      />
    </FormSubpageShell>
  );
}
