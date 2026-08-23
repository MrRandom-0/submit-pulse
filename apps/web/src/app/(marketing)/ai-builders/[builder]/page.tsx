import { Button, Badge, Card, CardContent } from "@submitpulse/ui";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { brand, formEndpoint } from "@submitpulse/config/brand";
import {
  MARKETING_BUILDER_IDS,
  BUILDERS,
} from "@submitpulse/config/builders";
import type { BuilderId } from "@submitpulse/config/builders";

export function generateStaticParams(): { builder: string }[] {
  return MARKETING_BUILDER_IDS.map((id) => ({ builder: id }));
}

interface Props {
  readonly params: Promise<{ readonly builder: string }>;
}

function isMarketingBuilderId(id: string): id is BuilderId {
  return (MARKETING_BUILDER_IDS as readonly string[]).includes(id);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { builder: builderId } = await params;
  if (!isMarketingBuilderId(builderId)) return {};
  const builder = BUILDERS[builderId];
  return {
    title: `${builder.label} + ${brand.name} — Form Integration Guide`,
    description: `Add a reliable form backend to your ${builder.label} website. Works with websites built using ${builder.label}. No server required.`,
  };
}

function getSnippet(builderId: BuilderId, formId: string): string {
  const endpoint = formEndpoint(formId);
  const builder = BUILDERS[builderId];

  if (builder.snippetFlavour === "nextjs" || builder.snippetFlavour === "react") {
    return `async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.currentTarget));

  const res = await fetch("${endpoint}", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (res.ok) {
    // show success state
  } else {
    // show error state
  }
}`;
  }

  if (builder.snippetFlavour === "html") {
    return `<form
  action="${endpoint}"
  method="POST"
  enctype="application/x-www-form-urlencoded"
>
  <input name="name" type="text" required />
  <input name="email" type="email" required />
  <textarea name="message"></textarea>
  <button type="submit">Send</button>
</form>`;
  }

  if (builder.snippetFlavour === "vue") {
    return `<script setup lang="ts">
async function handleSubmit(e: Event) {
  const form = e.target as HTMLFormElement;
  const data = Object.fromEntries(new FormData(form));

  await fetch("${endpoint}", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}
</script>

<template>
  <form @submit.prevent="handleSubmit">
    <input name="name" type="text" />
    <input name="email" type="email" />
    <button type="submit">Send</button>
  </form>
</template>`;
  }

  if (builder.snippetFlavour === "svelte") {
    return `<script lang="ts">
  async function handleSubmit(e: SubmitEvent) {
    const data = Object.fromEntries(
      new FormData(e.currentTarget as HTMLFormElement)
    );
    await fetch("${endpoint}", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  }
</script>

<form on:submit|preventDefault={handleSubmit}>
  <input name="name" type="text" />
  <input name="email" type="email" />
  <button type="submit">Send</button>
</form>`;
  }

  if (builder.snippetFlavour === "astro") {
    return `---
// ContactForm.astro — no client directive needed for plain HTML form
---

<form action="${endpoint}" method="POST">
  <input name="name" type="text" required />
  <input name="email" type="email" required />
  <textarea name="message"></textarea>
  <button type="submit">Send</button>
</form>`;
  }

  // none / fallback
  return `POST ${endpoint}
Content-Type: application/json

{ "name": "...", "email": "...", "message": "..." }`;
}

function getIntegrationPrompt(builderId: BuilderId, formId: string): string {
  const endpoint = formEndpoint(formId);
  const builder = BUILDERS[builderId];
  const scopeNote = builder.understandsRepoWideInstruction
    ? "Apply this change across the project."
    : "Apply this change to the currently open form component.";
  const envNote = builder.hasEnvVars
    ? "You may store the endpoint URL in an environment variable if you prefer."
    : "Do not use environment variables — the endpoint URL is public by design and safe to include inline.";
  const caveatNote = builder.caveats.length > 0
    ? `\n\nIMPORTANT: ${builder.caveats[0]}`
    : "";

  return `Update the contact form so that when it is submitted it sends a POST request to:

  ${endpoint}

Use fetch() with:
  method: "POST"
  headers: { "Content-Type": "application/json" }
  body: JSON.stringify({ name, email, message })

Show a success message on 2xx and an error message on any other status.

${scopeNote} ${envNote}${caveatNote}`;
}

const EXAMPLE_FORM_ID = "fm_example01";

export default async function BuilderPage({ params }: Props) {
  const { builder: builderId } = await params;
  if (!isMarketingBuilderId(builderId)) notFound();
  const builder = BUILDERS[builderId];

  const snippet = getSnippet(builderId, EXAMPLE_FORM_ID);
  const prompt = getIntegrationPrompt(builderId, EXAMPLE_FORM_ID);

  const SURFACE_VERB: Record<typeof builder.surface, string> = {
    chat_agent: "Paste into the chat",
    ide_agent: "Paste into the agent panel",
    visual_editor: "Follow the visual steps",
    manual: "Edit your form component",
  };

  return (
    <>
      {/* Header */}
      <section
        aria-labelledby="builder-page-heading"
        className="border-b border-border bg-background py-24"
      >
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <nav aria-label="Breadcrumb" className="mb-8">
            <ol className="flex items-center gap-2 text-sm text-text-muted">
              <li>
                <Link href="/ai-builders" className="hover:text-text-secondary">
                  AI Builders
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li className="text-text-secondary">{builder.label}</li>
            </ol>
          </nav>
          <div className="mx-auto max-w-3xl">
            <Badge variant="neutral" className="mb-6">
              Works with websites built using {builder.label}
            </Badge>
            <h1
              id="builder-page-heading"
              className="text-4xl font-bold tracking-tight text-text-primary sm:text-5xl"
            >
              Add reliable forms to your {builder.label} site
            </h1>
            <p className="mt-6 text-lg text-text-secondary leading-relaxed">
              {brand.name} gives your {builder.label}-built website a secure
              form backend. Receive submissions, block spam, and know
              immediately if your form stops working.
            </p>
            <div className="mt-8 flex gap-3">
              <Button variant="primary" size="lg" asChild>
                <Link href="/signup">Create your endpoint</Link>
              </Button>
              <Button variant="secondary" size="lg" asChild>
                <Link href="/ai-builders">All builders</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Integration prompt */}
      <section
        aria-labelledby="prompt-heading"
        className="border-b border-border bg-surface py-24"
      >
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-3xl">
            <div className="flex items-center gap-3 mb-4">
              <Badge variant="info">Step 1</Badge>
              <h2
                id="prompt-heading"
                className="text-xl font-semibold text-text-primary"
              >
                {SURFACE_VERB[builder.surface]}
              </h2>
            </div>
            <p className="mb-6 text-sm text-text-secondary">
              After creating your endpoint in the dashboard, copy the prompt
              below and paste it into {builder.label}. Replace{" "}
              <code className="text-xs bg-code-background px-1.5 py-0.5 rounded font-mono">
                {EXAMPLE_FORM_ID}
              </code>{" "}
              with your real form ID.
            </p>
            <div className="rounded-card border border-border bg-code-background p-6 font-mono">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs text-text-muted">
                  Integration prompt · {builder.label}
                </span>
              </div>
              <pre className="overflow-x-auto text-xs text-text-secondary leading-relaxed whitespace-pre-wrap">
                <code>{prompt}</code>
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* Code snippet */}
      {builder.snippetFlavour !== "none" && (
        <section
          aria-labelledby="snippet-heading"
          className="border-b border-border bg-background py-24"
        >
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto max-w-3xl">
              <div className="flex items-center gap-3 mb-4">
                <Badge variant="success">Step 2</Badge>
                <h2
                  id="snippet-heading"
                  className="text-xl font-semibold text-text-primary"
                >
                  Expected output
                </h2>
              </div>
              <p className="mb-6 text-sm text-text-secondary">
                This is the code pattern {builder.label} should generate. If
                the output looks significantly different, paste the prompt again
                with the form component in focus.
              </p>
              <div className="rounded-card border border-border bg-code-background p-6 font-mono">
                <pre className="overflow-x-auto text-xs text-text-secondary leading-relaxed">
                  <code>{snippet}</code>
                </pre>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Caveats */}
      {builder.caveats.length > 0 && (
        <section
          aria-labelledby="caveats-heading"
          className="border-b border-border bg-surface py-16"
        >
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto max-w-3xl">
              <h2
                id="caveats-heading"
                className="text-lg font-semibold text-text-primary mb-6"
              >
                {builder.label}-specific notes
              </h2>
              <ul className="flex flex-col gap-4" role="list">
                {builder.caveats.map((caveat, i) => (
                  <li key={i} className="flex gap-4">
                    <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-warning/10 text-warning text-xs font-semibold">
                      !
                    </span>
                    <p className="text-sm text-text-secondary leading-relaxed">
                      {caveat}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      {/* What happens next */}
      <section
        aria-labelledby="next-steps-heading"
        className="border-b border-border bg-background py-24"
      >
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-3xl">
            <h2
              id="next-steps-heading"
              className="text-2xl font-bold tracking-tight text-text-primary mb-8"
            >
              What happens after setup
            </h2>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              {[
                {
                  title: "Submissions arrive in your inbox",
                  body: "Every submission is stored, searchable, and exportable. Email notifications fire immediately.",
                },
                {
                  title: "Spam is filtered automatically",
                  body: "Server-side honeypot, velocity limiting, and domain reputation checks run on every submission.",
                },
                {
                  title: "Health tests start running",
                  body: "Pulse Monitor begins synthetic tests so you know before a user does if your form breaks.",
                },
                {
                  title: "Schema drift is detected",
                  body: "If a later prompt changes field names, Schema Drift alerts you so integrations don't break silently.",
                },
              ].map((item) => (
                <Card key={item.title}>
                  <CardContent className="pt-6">
                    <h3 className="text-sm font-semibold text-text-primary mb-2">
                      {item.title}
                    </h3>
                    <p className="text-sm text-text-secondary">{item.body}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-surface py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-text-primary">
            Ready to connect your {builder.label} site?
          </h2>
          <p className="mt-4 text-base text-text-secondary">
            Create a free endpoint in under two minutes.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Button variant="primary" size="lg" asChild>
              <Link href="/signup">Start for free</Link>
            </Button>
            <Button variant="secondary" size="lg" asChild>
              <Link href="/pricing">View pricing</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
