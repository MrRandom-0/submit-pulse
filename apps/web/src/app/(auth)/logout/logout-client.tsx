"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Card, CardDescription, CardHeader, CardTitle, Spinner } from "@submitpulse/ui";
import { brand } from "@submitpulse/config";

export default function LogoutClient() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function doLogout() {
      try {
        const res = await fetch("/api/auth/logout", { method: "POST" });
        if (!cancelled) {
          if (!res.ok) {
            const json = (await res.json()) as { error?: string };
            setError(json.error ?? "Sign-out failed. Please try again.");
          } else {
            router.replace("/login");
          }
        }
      } catch {
        if (!cancelled) {
          setError("Something went wrong. Please try again.");
        }
      }
    }

    void doLogout();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sign-out failed</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
        {/* No-JS fallback form */}
        <form action="/api/auth/logout" method="POST" className="p-6 pt-0">
          <button
            type="submit"
            className="text-sm text-primary hover:underline underline-offset-4"
          >
            Try again
          </button>
        </form>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Spinner className="h-5 w-5 text-primary" />
          <div>
            <CardTitle>Signing out of {brand.name}&hellip;</CardTitle>
            <CardDescription>You will be redirected shortly.</CardDescription>
          </div>
        </div>
      </CardHeader>

      {/* No-JS fallback */}
      <noscript>
        <form action="/api/auth/logout" method="POST" className="px-6 pb-6">
          <button
            type="submit"
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-white"
          >
            Sign out
          </button>
        </form>
      </noscript>
    </Card>
  );
}
