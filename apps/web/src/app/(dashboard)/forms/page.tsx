import Link from "next/link";
import { Button, EmptyState, Skeleton } from "@submitpulse/ui";
import { listForms } from "@/lib/dashboard-data";
import { FormCard } from "@/components/dashboard/FormCard";
import type { Actor } from "@submitpulse/auth/permissions";

// ---------------------------------------------------------------------------
// Fixture actor — replace with real session lookup in production
// ---------------------------------------------------------------------------
const FIXTURE_ACTOR: Actor = {
  userId: "user-001",
  workspaceId: "ws-1",
  role: "admin",
};

// ---------------------------------------------------------------------------
// Page (Server Component)
// ---------------------------------------------------------------------------

export default async function FormsPage() {
  const forms = await listForms();
  const actor = FIXTURE_ACTOR;

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Forms</h1>
          <p className="text-sm text-text-muted mt-0.5">
            {forms.length} form{forms.length !== 1 ? "s" : ""} in this workspace
          </p>
        </div>
        <Button variant="primary" size="sm" asChild>
          <Link href="/forms/new">New form</Link>
        </Button>
      </div>

      {/* Filter bar — client interactivity stub handled by search params in a real app */}
      <div className="flex gap-2 flex-wrap">
        <span className="px-3 py-1.5 text-sm rounded-pill border border-border text-text-secondary bg-background">
          All
        </span>
        <span className="px-3 py-1.5 text-sm rounded-pill border border-border text-text-muted bg-background hover:bg-surface cursor-pointer">
          Active
        </span>
        <span className="px-3 py-1.5 text-sm rounded-pill border border-border text-text-muted bg-background hover:bg-surface cursor-pointer">
          Paused
        </span>
        <span className="px-3 py-1.5 text-sm rounded-pill border border-border text-text-muted bg-background hover:bg-surface cursor-pointer">
          Needs attention
        </span>
      </div>

      {/* Form list */}
      {forms.length === 0 ? (
        <EmptyState
          title="No forms yet"
          description="Create your first form to start collecting submissions from any website — no server required."
          action={
            <Button variant="primary" size="md" asChild>
              <Link href="/forms/new">Create your first form</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-6">
          {forms.map((form) => (
            <FormCard key={form.id} form={form} actor={actor} />
          ))}
        </div>
      )}
    </div>
  );
}
