import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Badge,
  Button,
} from "@submitpulse/ui";
import { PLANS, ORDERED_PLANS } from "@submitpulse/config";
import type { Actor } from "@submitpulse/auth/permissions";
import { can } from "@submitpulse/auth/permissions";
import { PermissionGate } from "@/components/dashboard/PermissionGate";
import { cn } from "@submitpulse/ui";

const FIXTURE_ACTOR: Actor = {
  userId: "user-001",
  workspaceId: "ws-1",
  role: "admin",
};

const CURRENT_PLAN = "pro";

export default function BillingPage() {
  const actor = FIXTURE_ACTOR;
  const canManage = can(actor, "billing:manage");
  const canRead = can(actor, "billing:read");

  if (!canRead) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-4xl mx-auto">
        <p className="text-sm text-text-muted">You do not have permission to view billing.</p>
      </div>
    );
  }

  const plan = PLANS[CURRENT_PLAN];

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Billing</h1>
        <p className="text-sm text-text-muted mt-0.5">
          Manage your subscription and payment method
        </p>
      </div>

      {/* Current plan */}
      <Card className="rounded-card shadow-card">
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle>Current plan</CardTitle>
              <CardDescription>Your active subscription</CardDescription>
            </div>
            <Badge variant="success">{plan.name}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-text-secondary">Monthly cost</span>
            <span className="text-text-primary font-semibold">
              ${(plan.priceMonthlyCents / 100).toFixed(0)}/month
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-secondary">Next billing date</span>
            <span className="text-text-primary">September 1, 2026</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-secondary">Payment method</span>
            <span className="text-text-primary">Visa ending 4242</span>
          </div>
          {canManage && (
            <div className="flex gap-2 pt-2">
              <Button variant="secondary" size="sm">Update payment</Button>
              <Button variant="danger" size="sm">Cancel plan</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Plan comparison */}
      <div>
        <h2 className="text-lg font-semibold text-text-primary mb-4">Available plans</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {ORDERED_PLANS.map((p) => {
            const isCurrent = p.id === CURRENT_PLAN;
            return (
              <Card
                key={p.id}
                className={cn(
                  "rounded-card",
                  isCurrent ? "border-primary shadow-md" : "shadow-card",
                )}
              >
                <CardHeader>
                  <div className="flex items-center justify-between gap-1">
                    <CardTitle className="text-base">{p.name}</CardTitle>
                    {isCurrent && <Badge variant="success">Current</Badge>}
                  </div>
                  <div className="text-xl font-bold text-text-primary">
                    {p.priceMonthlyCents === 0 ? "Free" : `$${p.priceMonthlyCents / 100}`}
                    {p.priceMonthlyCents > 0 && (
                      <span className="text-sm font-regular text-text-muted">/mo</span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-1 text-xs text-text-muted">
                  <p>{p.quotas.forms === null ? "Unlimited" : p.quotas.forms} forms</p>
                  <p>{p.quotas.submissionsPerMonth === null ? "Unlimited" : p.quotas.submissionsPerMonth.toLocaleString("en-US")} submissions/mo</p>
                  <p>{p.quotas.members} member{p.quotas.members !== 1 ? "s" : ""}</p>
                </CardContent>
                {canManage && !isCurrent && (
                  <div className="px-6 pb-4">
                    <Button variant="primary" size="sm" className="w-full">
                      {p.priceMonthlyCents > plan.priceMonthlyCents ? "Upgrade" : "Downgrade"}
                    </Button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
