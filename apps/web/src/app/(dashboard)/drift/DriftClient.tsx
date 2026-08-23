"use client";

/**
 * Schema Drift Guard — client shell.
 *
 * SAFETY INVARIANT: Drift is NEVER auto-applied. Every resolution action
 * (Accept, Map, Ignore) requires explicit user confirmation through a Dialog.
 * This comment mirrors the database invariant in schema_drift_events.
 */

import * as React from "react";
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  EmptyState,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@submitpulse/ui";
import { DriftRow } from "@/components/scanner/DriftRow";
import type { DriftEventFixture } from "@/lib/scanner-data";

// ---------------------------------------------------------------------------

interface DriftClientProps {
  initialEvents: DriftEventFixture[];
}

export function DriftClient({ initialEvents }: DriftClientProps) {
  const [events, setEvents] = React.useState(initialEvents);

  // ---------------------------------------------------------------------------
  // Action handlers — stub implementations (real calls would hit an API route)
  // ---------------------------------------------------------------------------

  function handleAccept(id: string) {
    // SAFETY: This would POST to /api/drift/[id]/accept, which creates a new
    // schema version. Never auto-applied — the user confirmed above.
    setEvents((prev) =>
      prev.map((e) => (e.id === id ? { ...e, resolution: "accepted" as const } : e)),
    );
  }

  function handleIgnore(id: string) {
    setEvents((prev) =>
      prev.map((e) => (e.id === id ? { ...e, resolution: "ignored" as const } : e)),
    );
  }

  function handleMapFields(_id: string) {
    // TODO: open field mapper drawer (out of scope for this task).
    // Stubbed — non-destructive, no confirm needed.
    alert("Field mapper coming soon.");
  }

  function handleGenerateRepair(_id: string) {
    // TODO: POST to /api/drift/[id]/repair-prompt and refresh the event.
    alert("Repair prompt generation coming soon.");
  }

  // ---------------------------------------------------------------------------
  // Tabs: Unresolved | All
  // ---------------------------------------------------------------------------

  const unresolved = events.filter((e) => e.resolution === "unresolved");
  const all = events;

  function renderList(list: DriftEventFixture[]) {
    if (list.length === 0) {
      return (
        <EmptyState
          title="No drift events"
          description="No schema drift has been detected for the selected filter."
        />
      );
    }

    // Group by form name
    const byForm = new Map<string, DriftEventFixture[]>();
    for (const e of list) {
      const existing = byForm.get(e.formName);
      if (existing !== undefined) {
        existing.push(e);
      } else {
        byForm.set(e.formName, [e]);
      }
    }

    return (
      <div className="space-y-8">
        {[...byForm.entries()].map(([formName, formEvents]) => (
          <section key={formName} aria-label={`Drift events for ${formName}`}>
            <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
              {formName}
              <Badge variant="neutral" size="sm">
                {formEvents.length}
              </Badge>
            </h3>
            <div className="space-y-2">
              {formEvents.map((event) => (
                <DriftRow
                  key={event.id}
                  event={event}
                  onAccept={handleAccept}
                  onIgnore={handleIgnore}
                  onMapFields={handleMapFields}
                  onGenerateRepair={handleGenerateRepair}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(
          [
            { label: "Unresolved", count: events.filter((e) => e.resolution === "unresolved").length, variant: "warning" },
            { label: "Accepted", count: events.filter((e) => e.resolution === "accepted").length, variant: "info" },
            { label: "Mapped", count: events.filter((e) => e.resolution === "mapped").length, variant: "info" },
            { label: "Ignored", count: events.filter((e) => e.resolution === "ignored").length, variant: "neutral" },
          ] as const
        ).map(({ label, count, variant }) => (
          <Card key={label} className="rounded-card shadow-card text-center">
            <CardContent className="pt-4 pb-3">
              <div className="text-2xl font-bold text-text-primary tabular-nums">{count}</div>
              <Badge variant={variant} size="sm" className="mt-1">{label}</Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Drift table */}
      <Card className="rounded-card shadow-card">
        <CardHeader>
          <CardTitle>Drift events</CardTitle>
          <CardDescription>
            Before/after comparison of expected schema vs observed payload.
            Drift is never auto-applied — every change requires explicit review.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="unresolved">
            <TabsList>
              <TabsTrigger value="unresolved">
                Unresolved
                {unresolved.length > 0 && (
                  <Badge variant="warning" size="sm" className="ml-1.5">
                    {unresolved.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="all">All events</TabsTrigger>
            </TabsList>

            <TabsContent value="unresolved" className="mt-4">
              {renderList(unresolved)}
            </TabsContent>

            <TabsContent value="all" className="mt-4">
              {renderList(all)}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
