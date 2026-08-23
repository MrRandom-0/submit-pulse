"use client";

import { useState } from "react";
import { Button } from "@submitpulse/ui";
import { auditedAction } from "@/components/admin/auditedAction";
import { FIXTURE_OPS_EMAIL } from "@/lib/admin-data";

interface FeatureFlagToggleProps {
  flagId: string;
  flagKey: string;
  enabledGlobally: boolean;
}

export function FeatureFlagToggle({
  flagId,
  flagKey,
  enabledGlobally,
}: FeatureFlagToggleProps) {
  const [enabled, setEnabled] = useState(enabledGlobally);
  const [loading, setLoading] = useState(false);

  async function handleToggle() {
    setLoading(true);
    const result = await auditedAction(
      {
        actorId: "usr-005",
        actorLabel: FIXTURE_OPS_EMAIL,
        actorType: "support",
        action: enabled ? "feature_flag.disabled" : "feature_flag.enabled",
        workspaceId: "platform",
        resourceType: "feature_flag",
        resourceId: flagId,
        reason: `Operator toggled flag ${flagKey}`,
        before: { enabledGlobally: enabled },
        after: { enabledGlobally: !enabled },
      },
      async () => {
        // DEVELOPMENT FIXTURE — replace with real Drizzle UPDATE
        await new Promise<void>((res) => setTimeout(res, 300));
      },
    );
    setLoading(false);
    if (result.ok) setEnabled((v) => !v);
  }

  return (
    <Button
      variant={enabled ? "danger" : "secondary"}
      size="sm"
      onClick={handleToggle}
      loading={loading}
    >
      {enabled ? "Disable globally" : "Enable globally"}
    </Button>
  );
}
