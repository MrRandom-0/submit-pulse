import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
} from "@submitpulse/ui";
import Link from "next/link";
import { PLANS } from "@submitpulse/config";
import { getOverviewMetrics } from "@/lib/dashboard-data";
import { UsageMeter } from "@/components/dashboard/UsageMeter";
import type { Actor } from "@submitpulse/auth/permissions";
import { can } from "@submitpulse/auth/permissions";
import { PermissionGate } from "@/components/dashboard/PermissionGate";

const FIXTURE_ACTOR: Actor = {
  userId: "user-001",
  workspaceId: "ws-1",
  role: "admin",
};

export default async function UsagePage() {
  const metrics = await getOverviewMetrics();
  const plan = PLANS[metrics.plan];

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Usage</h1>
          <p className="text-sm text-text-muted mt-0.5">
            Current billing period usage on the {plan.name} plan
          </p>
        </div>
        <PermissionGate actor={FIXTURE_ACTOR} permission="billing:read">
          <Button variant="secondary" size="sm" asChild>
            <Link href="/billing">Billing</Link>
          </Button>
        </PermissionGate>
      </div>

      <Card className="rounded-card shadow-card">
        <CardHeader>
          <CardTitle>Quota usage</CardTitle>
          <CardDescription>
            Resets at the start of each billing period
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <UsageMeter
            label="Submissions this month"
            used={metrics.submissionsUsed}
            quota={metrics.submissionsQuota}
          />
          <UsageMeter
            label="Forms"
            used={metrics.formsUsed}
            quota={metrics.formsQuota}
          />
          <UsageMeter
            label="Team members"
            used={3}
            quota={plan.quotas.members}
          />
          <UsageMeter
            label="File storage"
            used={1_240}
            quota={plan.quotas.fileStorageMb}
            unit="MB"
          />
          <UsageMeter
            label="Health tests this month"
            used={4_820}
            quota={plan.quotas.healthTestsPerMonth}
          />
          <UsageMeter
            label="AI analyses this month"
            used={37}
            quota={plan.quotas.aiAnalysesPerMonth}
          />
        </CardContent>
      </Card>

      <Card className="rounded-card shadow-card">
        <CardHeader>
          <CardTitle>History retention</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-text-secondary">
          Submissions are retained for{" "}
          <strong className="text-text-primary">
            {plan.quotas.historyDays === null
              ? "unlimited days"
              : `${plan.quotas.historyDays} days`}
          </strong>{" "}
          on the {plan.name} plan.
        </CardContent>
      </Card>
    </div>
  );
}
