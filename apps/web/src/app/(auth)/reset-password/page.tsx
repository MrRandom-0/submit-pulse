"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Field,
  FieldError,
  Input,
  Label,
} from "@submitpulse/ui";

/* -------------------------------------------------------------------------- */
/* Schema                                                                      */
/* -------------------------------------------------------------------------- */

const resetSchema = z.object({
  email: z.string().email("Enter a valid email address."),
});

type ResetFields = z.infer<typeof resetSchema>;

/* -------------------------------------------------------------------------- */
/* Page                                                                        */
/* -------------------------------------------------------------------------- */

export default function ResetPasswordPage() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetFields>({ resolver: zodResolver(resetSchema) });

  async function onSubmit(data: ResetFields) {
    setServerError(null);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.email }),
      });
      /**
       * SECURITY — ENUMERATION PREVENTION:
       * The API ALWAYS returns 200 whether the address is registered or not.
       * We move to the "check your email" state unconditionally on 200.
       * Do not reveal whether the account exists.
       */
      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        setServerError(json.error ?? "Unable to send reset email. Try again.");
        return;
      }
      setSubmitted(true);
    } catch {
      setServerError("Something went wrong. Please try again.");
    }
  }

  if (submitted) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Check your email</CardTitle>
          <CardDescription>
            If an account exists for that address, you&apos;ll receive a
            password-reset link shortly. It expires in 1 hour.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-text-muted">
            Check your spam folder if it doesn&apos;t arrive.
          </p>
        </CardContent>
        <CardFooter className="justify-center">
          <Link
            href="/login"
            className="text-sm text-text-muted hover:text-text-primary transition-colors"
          >
            Back to sign in
          </Link>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reset your password</CardTitle>
        <CardDescription>
          Enter your email and we&apos;ll send you a reset link.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {serverError ? (
          <div
            role="alert"
            aria-live="assertive"
            className="rounded-md bg-danger/10 border border-danger/30 px-4 py-3 text-sm text-danger"
          >
            {serverError}
          </div>
        ) : null}

        <form
          onSubmit={(e) => void handleSubmit(onSubmit)(e)}
          noValidate
          className="space-y-4"
        >
          <Field>
            <Label htmlFor="reset-email">Email</Label>
            <Input
              id="reset-email"
              type="email"
              autoComplete="email"
              aria-describedby={errors.email ? "reset-email-error" : undefined}
              aria-invalid={!!errors.email}
              {...register("email")}
            />
            {errors.email ? (
              <FieldError id="reset-email-error">
                {errors.email.message}
              </FieldError>
            ) : null}
          </Field>

          <Button
            type="submit"
            className="w-full"
            loading={isSubmitting}
            disabled={isSubmitting}
          >
            Send reset link
          </Button>
        </form>
      </CardContent>

      <CardFooter className="justify-center">
        <Link
          href="/login"
          className="text-sm text-text-muted hover:text-text-primary transition-colors"
        >
          Back to sign in
        </Link>
      </CardFooter>
    </Card>
  );
}
