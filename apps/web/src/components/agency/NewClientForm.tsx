"use client";

import { useId, useState } from "react";

import {
  Button,
  Card,
  CardContent,
  CardFooter,
  Field,
  FieldError,
  Input,
  Label,
  useToast,
} from "@submitpulse/ui";

/**
 * Client-workspace creation form.
 *
 * NOT WIRED — no database connection exists, so submission does not persist.
 * The UI states this plainly rather than showing a success state that implies
 * a workspace was created. Replace `createClientWorkspace` with a server action
 * calling packages/database when a database is provisioned.
 */

interface Errors {
  name?: string;
  slug?: string;
}

/** Mirrors the workspaces_slug_shape CHECK constraint in the database. */
const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/;

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

export function NewClientForm() {
  const { toast } = useToast();
  const nameId = useId();
  const slugId = useId();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);

  const effectiveSlug = slugTouched ? slug : slugify(name);

  function validate(): boolean {
    const next: Errors = {};
    if (name.trim().length < 2) {
      next.name = "Enter a client name of at least 2 characters.";
    }
    if (!SLUG_RE.test(effectiveSlug)) {
      next.slug =
        "Use 3-50 lowercase letters, numbers or hyphens, starting and ending with a letter or number.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return; // prevent duplicate submission
    if (!validate()) return;

    setSubmitting(true);
    try {
      // Deliberately does not fake success. See file header.
      toast({
        variant: "error",
        title: "Not connected",
        description:
          "Client workspace creation is not wired to a database yet. Nothing was saved.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Card>
        <CardContent className="space-y-5 pt-6">
          <Field>
            <Label htmlFor={nameId}>Client name</Label>
            <Input
              id={nameId}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Northwind Coffee"
              invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? `${nameId}-error` : undefined}
              autoComplete="organization"
            />
            {errors.name ? (
              <FieldError id={`${nameId}-error`}>{errors.name}</FieldError>
            ) : null}
          </Field>

          <Field>
            <Label htmlFor={slugId}>Workspace handle</Label>
            <Input
              id={slugId}
              value={effectiveSlug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value);
              }}
              placeholder="northwind-coffee"
              invalid={Boolean(errors.slug)}
              aria-describedby={`${slugId}-hint${errors.slug ? ` ${slugId}-error` : ""}`}
            />
            <p id={`${slugId}-hint`} className="text-xs text-text-muted">
              Used in URLs. Derived from the client name until you edit it.
            </p>
            {errors.slug ? (
              <FieldError id={`${slugId}-error`}>{errors.slug}</FieldError>
            ) : null}
          </Field>
        </CardContent>

        <CardFooter className="justify-end gap-3">
          <Button type="button" variant="ghost" asChild>
            <a href="/agency">Cancel</a>
          </Button>
          <Button type="submit" loading={submitting}>
            Create client workspace
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
