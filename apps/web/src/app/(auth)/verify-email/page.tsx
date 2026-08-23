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
import { brand } from "@submitpulse/config";

/* -------------------------------------------------------------------------- */
/* Schema                                                                      */
/* -------------------------------------------------------------------------- */

const resendSchema = z.object({
  email: z.string().email("Enter a valid email address."),
});

type ResendFields = z.infer<typeof resendSchema>;

/* -------------------------------------------------------------------------- */
/* Page                                                                        */
/* -------------------------------------------------------------------------- */

export default function VerifyEmailPage() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResendFields>({ resolver: zodResolver(resendSchema) });

  async function onResend(data: ResendFields) {
    setServerError(null);
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.email }),
      });
      /**
       * SECURITY — ENUMERATION PREVENTION:
       * The API always returns 200 regardless of whether the email is
       * registered. We display the same success message in all cases.
       */
      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        setServerError(json.error ?? "Unable to resend. Please try again.");
        return;
      }
      setResent(true);
    } catch {
      setServerError("Something went wrong. Please try again.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Verify your email</CardTitle>
        <CardDescription>
          {resent
            ? "A new verification link is on its way."
            : `Check your inbox for a verification email from ${brand.email.from}.`}
        </CardDescription>
      </CardHeader>

      {!resent ? (
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

          <p className="text-sm text-text-muted">
            Didn&apos;t receive it? Enter your email to request a new link.
          </p>

          <form
            onSubmit={(e) => void handleSubmit(onResend)(e)}
            noValidate
            className="space-y-4"
          >
            <Field>
              <Label htmlFor="verify-email">Email</Label>
              <Input
                id="verify-email"
                type="email"
                autoComplete="email"
                aria-describedby={errors.email ? "verify-email-error" : undefined}
                aria-invalid={!!errors.email}
                {...register("email")}
              />
              {errors.email ? (
                <FieldError id="verify-email-error">
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
              Resend verification email
            </Button>
          </form>
        </CardContent>
      ) : (
        <CardContent>
          <p className="text-sm text-text-muted">
            If your email is registered, a new verification link has been sent.
            Check your spam folder if it doesn&apos;t arrive within a few minutes.
          </p>
        </CardContent>
      )}

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
