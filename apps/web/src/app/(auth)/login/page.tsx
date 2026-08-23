"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Metadata } from "next";

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

/* -------------------------------------------------------------------------- */
/* Schema                                                                      */
/* -------------------------------------------------------------------------- */

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

type LoginFields = z.infer<typeof loginSchema>;

const magicLinkSchema = z.object({
  email: z.string().email("Enter a valid email address."),
});

type MagicLinkFields = z.infer<typeof magicLinkSchema>;

/* -------------------------------------------------------------------------- */
/* OAuth button                                                                */
/* -------------------------------------------------------------------------- */

function OAuthButton({
  provider,
  label,
  loading,
  onClick,
}: {
  provider: "google" | "github";
  label: string;
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      disabled={loading}
      onClick={onClick}
      aria-label={`Sign in with ${label}`}
    >
      {loading ? <Spinner className="mr-2 h-4 w-4" /> : null}
      {provider === "google" ? (
        <svg
          className="mr-2 h-4 w-4"
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
      ) : (
        <svg
          className="mr-2 h-4 w-4"
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
        </svg>
      )}
      Continue with {label}
    </Button>
  );
}

/* -------------------------------------------------------------------------- */
/* Page                                                                        */
/* -------------------------------------------------------------------------- */

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextUrl = searchParams.get("next") ?? "/overview";
  const { toast } = useToast();

  const [mode, setMode] = useState<"password" | "magic">("password");
  const [oauthLoading, setOauthLoading] = useState<
    "google" | "github" | null
  >(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [magicSent, setMagicSent] = useState(false);

  /* Password form */
  const {
    register: regPw,
    handleSubmit: handlePw,
    formState: { errors: errPw, isSubmitting: isPwSubmitting },
  } = useForm<LoginFields>({ resolver: zodResolver(loginSchema) });

  /* Magic link form */
  const {
    register: regMl,
    handleSubmit: handleMl,
    formState: { errors: errMl, isSubmitting: isMlSubmitting },
  } = useForm<MagicLinkFields>({ resolver: zodResolver(magicLinkSchema) });

  async function onPasswordSubmit(data: LoginFields) {
    setServerError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.email, password: data.password }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        /**
         * SECURITY — ENUMERATION PREVENTION:
         * The API route returns the same generic message whether the account
         * does not exist or the password is wrong. We display that message
         * verbatim here — do not replace it with a more specific string.
         */
        setServerError(json.error ?? "Invalid email or password.");
        return;
      }
      router.push(nextUrl.startsWith("/") ? nextUrl : "/overview");
    } catch {
      setServerError("Something went wrong. Please try again.");
    }
  }

  async function onMagicLinkSubmit(data: MagicLinkFields) {
    setServerError(null);
    try {
      const res = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.email }),
      });
      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        setServerError(json.error ?? "Unable to send link. Please try again.");
        return;
      }
      setMagicSent(true);
    } catch {
      setServerError("Something went wrong. Please try again.");
    }
  }

  async function onOAuth(provider: "google" | "github") {
    setOauthLoading(provider);
    try {
      const res = await fetch(`/api/auth/oauth?provider=${provider}`, {
        method: "GET",
      });
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
      toast({
        title: "OAuth error",
        description: "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setOauthLoading(null);
    }
  }

  if (magicSent) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Check your email</CardTitle>
          <CardDescription>
            We sent a sign-in link to your inbox. It expires in 10 minutes.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => setMagicSent(false)}
          >
            Back to sign in
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in to {brand.name}</CardTitle>
        <CardDescription>
          {mode === "password"
            ? "Enter your email and password."
            : "Enter your email — we'll send a sign-in link."}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Server error announcement */}
        {serverError ? (
          <div
            role="alert"
            aria-live="assertive"
            className="rounded-md bg-danger/10 border border-danger/30 px-4 py-3 text-sm text-danger"
          >
            {serverError}
          </div>
        ) : null}

        {/* OAuth buttons */}
        <div className="space-y-2">
          <OAuthButton
            provider="google"
            label="Google"
            loading={oauthLoading === "google"}
            onClick={() => void onOAuth("google")}
          />
          <OAuthButton
            provider="github"
            label="GitHub"
            loading={oauthLoading === "github"}
            onClick={() => void onOAuth("github")}
          />
        </div>

        <div className="relative flex items-center gap-3">
          <div className="flex-1 border-t border-border" />
          <span className="text-xs text-text-muted">or</span>
          <div className="flex-1 border-t border-border" />
        </div>

        {mode === "password" ? (
          <form
            onSubmit={(e) => void handlePw(onPasswordSubmit)(e)}
            noValidate
            className="space-y-4"
          >
            <Field>
              <Label htmlFor="login-email">Email</Label>
              <Input
                id="login-email"
                type="email"
                autoComplete="email"
                aria-describedby={errPw.email ? "login-email-error" : undefined}
                aria-invalid={!!errPw.email}
                {...regPw("email")}
              />
              {errPw.email ? (
                <FieldError id="login-email-error">
                  {errPw.email.message}
                </FieldError>
              ) : null}
            </Field>

            <Field>
              <div className="flex items-center justify-between">
                <Label htmlFor="login-password">Password</Label>
                <Link
                  href="/reset-password"
                  className="text-xs text-text-muted hover:text-text-primary transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <Input
                id="login-password"
                type="password"
                autoComplete="current-password"
                aria-describedby={
                  errPw.password ? "login-password-error" : undefined
                }
                aria-invalid={!!errPw.password}
                {...regPw("password")}
              />
              {errPw.password ? (
                <FieldError id="login-password-error">
                  {errPw.password.message}
                </FieldError>
              ) : null}
            </Field>

            <Button
              type="submit"
              className="w-full"
              loading={isPwSubmitting}
              disabled={isPwSubmitting}
            >
              Sign in
            </Button>
          </form>
        ) : (
          <form
            onSubmit={(e) => void handleMl(onMagicLinkSubmit)(e)}
            noValidate
            className="space-y-4"
          >
            <Field>
              <Label htmlFor="magic-email">Email</Label>
              <Input
                id="magic-email"
                type="email"
                autoComplete="email"
                aria-describedby={errMl.email ? "magic-email-error" : undefined}
                aria-invalid={!!errMl.email}
                {...regMl("email")}
              />
              {errMl.email ? (
                <FieldError id="magic-email-error">
                  {errMl.email.message}
                </FieldError>
              ) : null}
            </Field>

            <Button
              type="submit"
              className="w-full"
              loading={isMlSubmitting}
              disabled={isMlSubmitting}
            >
              Send sign-in link
            </Button>
          </form>
        )}

        <Button
          type="button"
          variant="ghost"
          className="w-full text-sm"
          onClick={() => {
            setMode(mode === "password" ? "magic" : "password");
            setServerError(null);
          }}
        >
          {mode === "password"
            ? "Sign in with a magic link instead"
            : "Sign in with password instead"}
        </Button>
      </CardContent>

      <CardFooter className="justify-center">
        <p className="text-sm text-text-muted">
          Don&apos;t have an account?{" "}
          <Link
            href="/signup"
            className="text-primary hover:underline underline-offset-4"
          >
            Sign up
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
