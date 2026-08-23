"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  cn,
} from "@submitpulse/ui";
import {
  PASSWORD_MIN_LENGTH,
  checkPasswordSync,
} from "@submitpulse/auth";

/* -------------------------------------------------------------------------- */
/* Schema                                                                      */
/* -------------------------------------------------------------------------- */

const confirmSchema = z
  .object({
    password: z
      .string()
      .min(PASSWORD_MIN_LENGTH, `At least ${PASSWORD_MIN_LENGTH} characters required.`)
      .max(128, "Password must be no more than 128 characters."),
    confirmPassword: z.string().min(1, "Please confirm your password."),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

type ConfirmFields = z.infer<typeof confirmSchema>;

/* -------------------------------------------------------------------------- */
/* Strength meter                                                              */
/* -------------------------------------------------------------------------- */

function StrengthMeter({ password }: { password: string }) {
  if (!password) return null;

  const { strengthScore, violations } = checkPasswordSync(password);

  const labels: Record<number, string> = {
    0: "Too weak",
    1: "Weak",
    2: "Fair",
    3: "Good",
    4: "Strong",
  };

  const colours: Record<number, string> = {
    0: "bg-danger",
    1: "bg-danger",
    2: "bg-warning",
    3: "bg-success",
    4: "bg-success",
  };

  return (
    <div className="space-y-1.5" aria-live="polite">
      <div className="flex gap-1" aria-hidden="true">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors",
              i <= strengthScore
                ? colours[strengthScore] ?? "bg-border"
                : "bg-border",
            )}
          />
        ))}
      </div>
      <p className="text-xs text-text-muted">
        Strength:{" "}
        <span
          className={cn(
            "font-medium",
            strengthScore <= 1 && password.length > 0
              ? "text-danger"
              : strengthScore === 2
                ? "text-warning"
                : "text-success",
          )}
        >
          {labels[strengthScore] ?? "Unknown"}
        </span>
      </p>
      {violations.length > 0 ? (
        <ul className="space-y-0.5">
          {violations.map((v) => (
            <li key={v.code} className="text-xs text-danger">
              {v.message}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Page                                                                        */
/* -------------------------------------------------------------------------- */

export default function ResetPasswordConfirmPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [serverError, setServerError] = useState<string | null>(null);
  const [passwordValue, setPasswordValue] = useState("");

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ConfirmFields>({ resolver: zodResolver(confirmSchema) });

  const watchedPassword = watch("password", "");

  useEffect(() => {
    setPasswordValue(watchedPassword);
  }, [watchedPassword]);

  // If no token in URL, the link is malformed.
  const tokenMissing = !token;

  async function onSubmit(data: ConfirmFields) {
    setServerError(null);
    try {
      const res = await fetch("/api/auth/reset-password/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password: data.password }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setServerError(json.error ?? "Unable to reset password. The link may have expired.");
        return;
      }
      router.push("/overview");
    } catch {
      setServerError("Something went wrong. Please try again.");
    }
  }

  if (tokenMissing) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Invalid reset link</CardTitle>
          <CardDescription>
            This password-reset link is missing a token. Please use the link
            from your email.
          </CardDescription>
        </CardHeader>
        <CardFooter className="justify-center">
          <Link href="/reset-password" className="text-sm text-primary hover:underline underline-offset-4">
            Request a new reset link
          </Link>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Set a new password</CardTitle>
        <CardDescription>
          Choose a strong password. It must be at least {PASSWORD_MIN_LENGTH} characters.
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
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              aria-describedby={
                errors.password
                  ? "new-password-error"
                  : "new-password-strength"
              }
              aria-invalid={!!errors.password}
              {...register("password")}
            />
            {errors.password ? (
              <FieldError id="new-password-error">
                {errors.password.message}
              </FieldError>
            ) : null}
            <div id="new-password-strength">
              <StrengthMeter password={passwordValue} />
            </div>
          </Field>

          <Field>
            <Label htmlFor="confirm-new-password">Confirm new password</Label>
            <Input
              id="confirm-new-password"
              type="password"
              autoComplete="new-password"
              aria-describedby={
                errors.confirmPassword ? "confirm-password-error" : undefined
              }
              aria-invalid={!!errors.confirmPassword}
              {...register("confirmPassword")}
            />
            {errors.confirmPassword ? (
              <FieldError id="confirm-password-error">
                {errors.confirmPassword.message}
              </FieldError>
            ) : null}
          </Field>

          <Button
            type="submit"
            className="w-full"
            loading={isSubmitting}
            disabled={isSubmitting}
          >
            Set new password
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
