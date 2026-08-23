"use client";

import { useState } from "react";
import { Button } from "@submitpulse/ui";
import { auditedAction } from "@/components/admin/auditedAction";
import { FIXTURE_OPS_EMAIL } from "@/lib/admin-data";

interface RetryJobButtonProps {
  jobId: string;
  jobType: string;
  workspaceId: string;
}

export function RetryJobButton({ jobId, jobType, workspaceId }: RetryJobButtonProps) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleRetry() {
    setLoading(true);
    const result = await auditedAction(
      {
        actorId: "usr-005",
        actorLabel: FIXTURE_OPS_EMAIL,
        actorType: "support",
        action: "job.retried",
        workspaceId,
        resourceType: "background_job",
        resourceId: jobId,
        reason: `Manual retry of dead-lettered job type ${jobType}`,
      },
      async () => {
        // DEVELOPMENT FIXTURE — replace with queue provider retry API call
        await new Promise<void>((res) => setTimeout(res, 400));
      },
    );
    setLoading(false);
    if (result.ok) setDone(true);
  }

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={handleRetry}
      loading={loading}
      disabled={done}
    >
      {done ? "Queued" : "Retry"}
    </Button>
  );
}
