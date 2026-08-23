import { Button, Badge, Card, CardContent, CardHeader, CardTitle, CardDescription } from "@submitpulse/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { brand } from "@submitpulse/config/brand";
import { ORDERED_BUILDERS, MARKETING_BUILDER_IDS, BUILDERS } from "@submitpulse/config/builders";
import type { BuilderProfile } from "@submitpulse/config/builders";

export const metadata: Metadata = {
  title: `AI Builder Integrations — ${brand.name}`,
  description: `Connect ${brand.name} to your AI-generated website. Works with websites built using Lovable, Bolt, v0, Cursor, Claude Code, Codex, Replit, and more.`,
};

const CATEGORY_LABELS: Record<BuilderProfile["category"], string> = {
  ai_builder: "AI Builders",
  ai_ide: "AI IDEs",
  framework: "Frameworks",
  visual: "Visual Editors",
  other: "Other",
};

const SURFACE_LABELS: Record<BuilderProfile["surface"], string> = {
  chat_agent: "Chat agent",
  ide_agent: "IDE agent",
  visual_editor: "Visual editor",
  manual: "Manual",
};

export default function AiBuildersPage() {
  const featuredBuilders = MARKETING_BUILDER_IDS.map((id) => BUILDERS[id]);

  const byCategory = ORDERED_BUILDERS.reduce<
    Partial<Record<BuilderProfile["category"], BuilderProfile[]>>
  >((acc, builder) => {
    const existing = acc[builder.category] ?? [];
    return { ...acc, [builder.category]: [...existing, builder] };
  }, {});

  return (
    <>
      {/* Header */}
      <section
        aria-labelledby="builders-heading"
        className="border-b border-border bg-background py-24"
      >
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <Badge variant="neutral" className="mb-6">
              AI Builder Integrations
            </Badge>
            <h1
              id="builders-heading"
              className="text-4xl font-bold tracking-tight text-text-primary sm:text-5xl"
            >
              Works with websites built using your favourite tools
            </h1>
            <p className="mt-6 text-lg text-text-secondary leading-relaxed">
              Pick your builder and receive a tailored integration prompt.{" "}
              {brand.name} accounts for each tool's quirks so the AI wires up
              your form correctly on the first try.
            </p>
          </div>
        </div>
      </section>

      {/* Featured builders with dedicated pages */}
      <section
        aria-labelledby="featured-builders-heading"
        className="border-b border-border bg-surface py-24"
      >
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <h2
            id="featured-builders-heading"
            className="text-2xl font-bold tracking-tight text-text-primary mb-8"
          >
            Integration guides
          </h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featuredBuilders.map((builder) => (
              <Card key={builder.id} interactive>
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base">{builder.label}</CardTitle>
                    <Badge variant="neutral" size="sm">
                      {CATEGORY_LABELS[builder.category]}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription>
                    Integration via {SURFACE_LABELS[builder.surface]}.
                    {builder.hasEnvVars
                      ? " Supports environment variables."
                      : " No environment variable support — endpoint URL is public by design."}
                    {builder.caveats[0] !== undefined ? ` ${builder.caveats[0]}` : ""}
                  </CardDescription>
                  <div className="mt-4">
                    <Link
                      href={`/ai-builders/${builder.id}`}
                      className="text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring rounded"
                    >
                      View {builder.label} guide →
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* All builders by category */}
      <section
        aria-labelledby="all-builders-heading"
        className="border-b border-border bg-background py-24"
      >
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <h2
            id="all-builders-heading"
            className="text-2xl font-bold tracking-tight text-text-primary mb-12"
          >
            All supported tools
          </h2>
          <div className="flex flex-col gap-12">
            {(
              [
                "ai_builder",
                "ai_ide",
                "visual",
                "framework",
                "other",
              ] as BuilderProfile["category"][]
            ).map((cat) => {
              const builders = byCategory[cat];
              if (!builders?.length) return null;
              return (
                <div key={cat}>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-6">
                    {CATEGORY_LABELS[cat]}
                  </h3>
                  <ul
                    className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
                    role="list"
                  >
                    {builders.map((builder) => (
                      <li key={builder.id}>
                        <div className="rounded-card border border-border p-4">
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-sm font-medium text-text-primary">
                              {builder.label}
                            </span>
                            <Badge variant="neutral" size="sm">
                              {SURFACE_LABELS[builder.surface]}
                            </Badge>
                          </div>
                          {MARKETING_BUILDER_IDS.includes(builder.id) && (
                            <Link
                              href={`/ai-builders/${builder.id}`}
                              className="mt-2 inline-block text-xs text-primary hover:underline"
                            >
                              Guide →
                            </Link>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How the prompt works */}
      <section
        aria-labelledby="how-prompt-heading"
        className="border-b border-border bg-surface py-24"
      >
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center mb-16">
            <h2
              id="how-prompt-heading"
              className="text-3xl font-bold tracking-tight text-text-primary"
            >
              Why builder-specific prompts matter
            </h2>
            <p className="mt-4 text-base text-text-secondary">
              A generic "use fetch" prompt works maybe half the time. Builder
              prompts account for environment variable support, repo-wide
              instruction scope, and idiomatic code patterns.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {[
              {
                title: "Environment variables",
                body: "Some builders (Bolt, Cursor) support env vars. Others (Lovable, Framer) do not — and the prompt must not reference them or the AI will invent broken code.",
              },
              {
                title: "Scope awareness",
                body: "IDE agents understand repo-wide instructions. Chat builders may only see the active component. The prompt narrows or broadens its scope accordingly.",
              },
              {
                title: "Idiomatic patterns",
                body: "React, Next.js, Vue, Svelte, and plain HTML each have a correct submit pattern. Using the wrong one generates broken or non-idiomatic code the AI will fight against.",
              },
            ].map((item) => (
              <Card key={item.title}>
                <CardHeader>
                  <CardTitle className="text-base">{item.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>{item.body}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-background py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-text-primary">
            Ready to connect your site?
          </h2>
          <p className="mt-4 text-base text-text-secondary">
            Create an endpoint and choose your builder in under two minutes.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Button variant="primary" size="lg" asChild>
              <Link href="/signup">Create your endpoint</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
