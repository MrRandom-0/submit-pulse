import type { Metadata } from "next";
import Link from "next/link";

import { brand } from "@submitpulse/config";

export const metadata: Metadata = {
  title: {
    default: `Sign in · ${brand.name}`,
    template: `%s · ${brand.name}`,
  },
};

export default function AuthLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-4 py-12">
      {/* Ambient glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(560px_220px_at_50%_0%,var(--sp-primary),transparent)] opacity-[0.07]"
      />
      {/* Brand mark */}
      <div className="relative mb-8 flex flex-col items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[linear-gradient(135deg,var(--sp-primary),var(--sp-primary-deep))] text-base font-bold text-white shadow-md select-none">
          SP
        </span>
        <Link
          href={brand.domains.marketing}
          className="text-2xl font-bold tracking-tight text-text-primary hover:text-primary transition-colors"
          aria-label={`${brand.name} — back to marketing site`}
        >
          {brand.name}
        </Link>
        <p className="text-sm text-text-muted">{brand.tagline}</p>
      </div>

      {/* Page content — each route renders a Card inside this slot */}
      <main id="main" className="relative w-full max-w-md">
        {children}
      </main>

      {/* Back to marketing */}
      <p className="relative mt-8 text-sm text-text-muted">
        <Link
          href={brand.domains.marketing}
          className="hover:text-text-primary transition-colors underline-offset-4 hover:underline"
        >
          Back to {brand.name}
        </Link>
      </p>
    </div>
  );
}
