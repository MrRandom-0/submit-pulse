import type { Metadata } from "next";
import Link from "next/link";

import { brand, canUseFeature } from "@submitpulse/config";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@submitpulse/ui";

import { NewClientForm } from "@/components/agency/NewClientForm";

/**
 * Create a client workspace (agency mode).
 *
 * This page existed only as a link target before — the agency dashboard's
 * "Add client" button pointed at /agency/clients/new, which resolved to a 404.
 * The static audit caught it as a broken route.
 */

export const metadata: Metadata = {
  title: "New client workspace",
  description: `Create a client workspace in ${brand.name} agency mode.`,
};

export default function NewClientWorkspacePage() {
  // Agency mode is plan-gated. Entitlement is re-checked server-side here even
  // though the dashboard already hides the entry point, because a hidden
  // control is not an access control.
  const entitled = canUseFeature(
    { plan: "agency", usage: {} },
    "clientWorkspaces",
  );

  if (!entitled.allowed) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
        <Card>
          <CardHeader>
            <CardTitle>Agency mode required</CardTitle>
            <CardDescription>
              Client workspaces are available on the Agency plan.
              {entitled.upgradeTo ? ` Upgrade to ${entitled.upgradeTo}.` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/billing">View plans</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <nav aria-label="Breadcrumb" className="mb-2">
          <Link
            href="/agency"
            className="text-sm text-text-secondary underline-offset-4 hover:underline"
          >
            ← Back to agency dashboard
          </Link>
        </nav>
        <h1 className="text-2xl font-semibold text-text-primary">
          New client workspace
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          A client workspace is fully isolated. Its forms, submissions and
          members are separate from yours, and from every other client.
        </p>
      </div>

      <NewClientForm />
    </div>
  );
}
