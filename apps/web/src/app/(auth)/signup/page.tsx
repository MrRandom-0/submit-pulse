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
  Spinner,
  useToast,
} from "@submitpulse/ui";
import { brand } from "@submitpulse/config";
import { PASSWORD_MIN_LENGTH } from "@submitpulse/auth";

/* -------------------------------------------------------------------------- */
/* Schema                                                                      */
/* -------------------------------------------------------------------------- */

const signupSchema = z
  .object({
    email: z.string().email("Enter a valid email address."),
    password: z
      .string()
      .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`),
    confirmPassword: z.string().min(1, "Please confirm your password."),
    acceptTerms: z.boolean().refine((v) => v === true, {
      message: "You must accept the terms to continue.",
    }),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

type SignupFields = z.infer<typeof signupSchema>;

/* -------------------------------------------------------------------------- */
/* Page                                                                        */
/* -------------------------------------------------------------------------- */

export default function SignupPage() {
  const { toast } = useToast();
  const [oauthLoading, setOauthLoading] = useState<
    "google" | "github" | null
  >(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupFields>({ resolver: zodResolver(signupSchema) });

  async function onSubmit(data: SignupFields) {
    setServerError(null);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.email, password: data.password }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        /**
         * SECURITY — ENUMERATION PREVENTION:
         * The server returns the same "check your email" response whether
         * the address is new or already registered. We display that message
         * and move to the pending state. Do not differentiate here.
         */
        setServerError(json.error ?? "Unable to create account. Please try again.");
        return;
      }
      setSubmitted(true);
    } catch {
      setServerError("Something went wrong. Please try again.");
    }
  }

  async function onOAuth(provider: "google" | "github") {
    setOauthLoading(provider);
    try {
      const res = await fetch(`/api/auth/oauth?provider=${provider}`);
      const json = (await res.json()) as { redirectUrl?: string; error?: string };
      if (!res.ok || !json.redirectUrl) {
        toast({
          title: "OAuth error",
          description: json.error ?? "Could not start OAuth flow.",
          variant: "destructive",
        });
        return;
      }
      window.location.href = json.redirectUrl;
    } catch {
      toast({ title: "OAuth error", description: "Something went wrong.", variant: "destructive" });
    } finally {
      setOauthLoading(null);
    }
  }

  if (submitted) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Verify your email</CardTitle>
          <CardDescription>
            We&apos;ve sent a verification link to your inbox. Click it to activate
            your account. The link expires in 24 hours.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-text-muted">
            Didn&apos;t receive it? Check your spam folder or{" "}
            <Link href="/verify-email" className="text-primary hover:underline underline-offset-4">
              request a new link
            </Link>
            .
          </p>
        </CardContent>
        <CardFooter className="justify-center">
          <Link href="/login" className="text-sm text-text-muted hover:text-text-primary transition-colors">
            Back to sign in
          </Link>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create your account</CardTitle>
        <CardDescription>
          Email verification is required before you can sign in.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {serverError ? (
          <div
            role="alert"
            aria-live="assertive"
            className="rounded-md bg-danger/10 border border-danger/30 px-4 py-3 text-sm text-danger"
          >
            {serverError}
          </div>
        ) : null}

        {/* OAuth */}
        <div className="space-y-2">
          {(["google", "github"] as const).map((p) => (
            <Button
              key={p}
              type="button"
              variant="outline"
              className="w-full"
              disabled={oauthLoading !== null}
              onClick={() => void onOAuth(p)}
              aria-label={`Continue with ${p === "google" ? "Google" : "GitHub"}`}
            >
              {oauthLoading === p ? <Spinner className="mr-2 h-4 w-4" /> : null}
              Continue with {p === "google" ? "Google" : "GitHub"}
            </Button>
          ))}
        </div>

        <div className="relative flex items-center gap-3">
          <div className="flex-1 border-t border-border" />
          <span className="text-xs text-text-muted">or</span>
          <div className="flex-1 border-t border-border" />
        </div>

        <form
          onSubmit={(e) => void handleSubmit(onSubmit)(e)}
          noValidate
          className="space-y-4"
        >
          <Field>
            <Label htmlFor="signup-email">Email</Label>
            <Input
              id="signup-email"
              type="email"
              autoComplete="email"
              aria-describedby={errors.email ? "signup-email-error" : undefined}
              aria-invalid={!!errors.email}
              {...register("email")}
            />
            {errors.email ? (
              <FieldError id="signup-email-error">{errors.email.message}</FieldError>
            ) : null}
          </Field>

          <Field>
            <Label htmlFor="signup-password">Password</Label>
            <Input
              id="signup-password"
              type="password"
              autoComplete="new-password"
              aria-describedby={
                errors.password ? "signup-password-error" : "signup-password-hint"
              }
              aria-invalid={!!errors.password}
              {...register("password")}
            />
            <p id="signup-password-hint" className="text-xs text-text-muted">
              Minimum {PASSWORD_MIN_LENGTH} characters.
            </p>
            {errors.password ? (
              <FieldError id="signup-password-error">
                {errors.password.message}
              </FieldError>
            ) : null}
          </Field>

          <Field>
            <Label htmlFor="signup-confirm">Confirm password</Label>
            <Input
              id="signup-confirm"
              type="password"
              autoComplete="new-password"
              aria-describedby={
                errors.confirmPassword ? "signup-confirm-error" : undefined
              }
              aria-invalid={!!errors.confirmPassword}
              {...register("confirmPassword")}
            />
            {errors.confirmPassword ? (
              <FieldError id="signup-confirm-error">
                {errors.confirmPassword.message}
              </FieldError>
            ) : null}
          </Field>

          {/* Terms acceptance */}
          <div className="flex items-start gap-3">
            <input
              id="signup-terms"
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
              aria-describedby={errors.acceptTerms ? "signup-terms-error" : undefined}
              aria-invalid={!!errors.acceptTerms}
              {...register("acceptTerms")}
            />
            <div className="space-y-1">
              <Label htmlFor="signup-terms" className="font-normal leading-snug">
                I agree to the{" "}
                <Link
                  href="/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline underline-offset-4"
                >
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link
                  href="/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline underline-offset-4"
                >
                  Privacy Policy
                </Link>
                .
              </Label>
              {errors.acceptTerms ? (
                <FieldError id="signup-terms-error">
                  {errors.acceptTerms.message}
                </FieldError>
              ) : null}
            </div>
          </div>

          <Button
            type="submit"
            className="w-full"
            loading={isSubmitting}
            disabled={isSubmitting}
          >
            Create account
          </Button>
        </form>
      </CardContent>

      <CardFooter className="justify-center">
        <p className="text-sm text-text-muted">
          Already have an account?{" "}
          <Link href="/login" className="text-primary hover:underline underline-offset-4">
            Sign in
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
