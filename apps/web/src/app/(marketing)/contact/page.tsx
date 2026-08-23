"use client";

import { Button, Badge, Card, CardContent } from "@submitpulse/ui";

import type { FormEvent } from "react";
import { useState } from "react";
import Link from "next/link";
import { brand } from "@submitpulse/config/brand";

// Client component — no server metadata export possible here.
// Parent layout provides the page title via the nav brand.

function ContactForm() {
  const [state, setState] = useState<"idle" | "submitting" | "success" | "error">("idle");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("submitting");
    try {
      // In production this would post to the actual form endpoint.
      await new Promise<void>((resolve) => setTimeout(resolve, 800));
      setState("success");
    } catch {
      setState("error");
    }
  }

  if (state === "success") {
    return (
      <div className="rounded-card border border-border bg-surface p-8 text-center">
        <p className="text-lg font-semibold text-text-primary mb-2">Message sent</p>
        <p className="text-sm text-text-secondary">
          We aim to respond within one business day.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label htmlFor="name" className="text-sm font-medium text-text-primary">
            Name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            autoComplete="name"
            className="h-9 rounded border border-border bg-surface px-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-focus-ring"
            placeholder="Your name"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="email" className="text-sm font-medium text-text-primary">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="h-9 rounded border border-border bg-surface px-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-focus-ring"
            placeholder="you@example.com"
          />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="subject" className="text-sm font-medium text-text-primary">
          Subject
        </label>
        <input
          id="subject"
          name="subject"
          type="text"
          className="h-9 rounded border border-border bg-surface px-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-focus-ring"
          placeholder="How can we help?"
        />
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="message" className="text-sm font-medium text-text-primary">
          Message
        </label>
        <textarea
          id="message"
          name="message"
          required
          rows={6}
          className="rounded border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-focus-ring resize-none"
          placeholder="Tell us what you need…"
        />
      </div>
      {state === "error" && (
        <p className="text-sm text-danger" role="alert">
          Something went wrong. Please try again or email us directly.
        </p>
      )}
      <Button
        type="submit"
        variant="primary"
        size="md"
        loading={state === "submitting"}
        className="self-start"
      >
        Send message
      </Button>
    </form>
  );
}

export default function ContactPage() {
  return (
    <>
      <section aria-labelledby="contact-heading" className="border-b border-border bg-background py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:items-start">
            <div>
              <Badge variant="neutral" className="mb-6">Contact</Badge>
              <h1 id="contact-heading" className="text-4xl font-bold tracking-tight text-text-primary sm:text-5xl">
                Get in touch
              </h1>
              <p className="mt-6 text-lg text-text-secondary leading-relaxed">
                Questions about the product, pricing, or your account? We aim
                to respond within one business day.
              </p>
              <div className="mt-10 flex flex-col gap-6">
                <div>
                  <p className="text-sm font-semibold text-text-primary mb-1">General</p>
                  <a href={`mailto:${brand.email.support}`} className="text-sm text-text-secondary hover:text-text-primary underline">
                    {brand.email.support}
                  </a>
                </div>
                <div>
                  <p className="text-sm font-semibold text-text-primary mb-1">Security</p>
                  <a href={`mailto:${brand.email.security}`} className="text-sm text-text-secondary hover:text-text-primary underline">
                    {brand.email.security}
                  </a>
                </div>
                <div>
                  <p className="text-sm font-semibold text-text-primary mb-1">Privacy</p>
                  <a href={`mailto:${brand.email.privacy}`} className="text-sm text-text-secondary hover:text-text-primary underline">
                    {brand.email.privacy}
                  </a>
                </div>
              </div>
            </div>
            <Card>
              <CardContent className="pt-6">
                <ContactForm />
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="bg-surface py-16">
        <div className="mx-auto max-w-7xl px-6 lg:px-8 text-center">
          <p className="text-sm text-text-muted">
            Looking for documentation?{" "}
            <Link href={brand.domains.docs} className="underline hover:text-text-secondary">
              Visit our docs →
            </Link>
          </p>
        </div>
      </section>
    </>
  );
}
