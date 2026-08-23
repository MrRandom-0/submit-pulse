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
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      {/* Brand mark */}
      <div className="mb-8 flex flex-col items-center gap-2">
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
      <main id="main" className="w-full max-w-md">
        {children}
      </main>

      {/* Back to marketing */}
      <p className="mt-8 text-sm text-text-muted">
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
