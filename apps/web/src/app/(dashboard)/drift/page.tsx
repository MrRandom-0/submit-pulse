import { listDriftEvents } from "@/lib/scanner-data";
import { DriftClient } from "./DriftClient";

export const metadata = {
  title: "Schema Drift Guard — SubmitPulse",
  description: "Review and resolve detected differences between your declared field schema and live form payloads.",
};

export default async function DriftPage() {
  const events = await listDriftEvents();

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Schema drift guard</h1>
        <p className="text-sm text-text-muted mt-0.5">
          Before/after view of differences between your declared schema and observed live payloads.
          Drift is never auto-applied — every change requires your explicit approval.
        </p>
      </div>

      <DriftClient initialEvents={events} />
    </div>
  );
}
