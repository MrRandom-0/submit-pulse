"use client";

/**
 * Admin layout — visually distinct from the customer dashboard.
 *
 * SECURITY DESIGN:
 * - A persistent banner informs operators that all actions are audited.
 * - Server-side admin gate is in AdminGate.tsx. In production the layout
 *   server component wraps AdminGate before rendering any child routes.
 * - Platform admins access the admin plane via isPlatformAdmin, NOT via
 *   workspace roles. `can()` from permissions.ts does NOT grant ambient access.
 */

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { brand } from "@submitpulse/config";
import { cn } from "@submitpulse/ui";
import type { ReactNode } from "react";
import { FIXTURE_OPS_EMAIL } from "@/lib/admin-data";

// ---------------------------------------------------------------------------
// Navigation items
// ---------------------------------------------------------------------------

interface AdminNavItem {
  href: string;
  label: string;
  icon: string;
  section?: string;
}

const ADMIN_NAV: AdminNavItem[] = [
  // Operations
  { href: "/admin", label: "Overview", icon: "⊞", section: "Operations" },
  { href: "/admin/jobs", label: "Jobs", icon: "⚙" },
  { href: "/admin/incidents", label: "Incidents", icon: "⚠" },

  // Users & Workspaces
  { href: "/admin/users", label: "Users", icon: "◈", section: "Platform" },
  { href: "/admin/workspaces", label: "Workspaces", icon: "⬡" },
  { href: "/admin/forms", label: "Forms", icon: "◻" },
  { href: "/admin/subscriptions", label: "Subscriptions", icon: "◇" },
  { href: "/admin/usage", label: "Usage", icon: "◷" },

  // Safety
  { href: "/admin/security", label: "Security", icon: "⊗", section: "Safety" },
  { href: "/admin/abuse", label: "Abuse", icon: "⊘" },

  // Delivery
  { href: "/admin/email", label: "Email", icon: "✉", section: "Delivery" },
  { href: "/admin/webhooks", label: "Webhooks", icon: "⇄" },

  // Config
  {
    href: "/admin/feature-flags",
    label: "Feature Flags",
    icon: "⚑",
    section: "Config",
  },
  { href: "/admin/audit", label: "Audit Log", icon: "▤" },
];

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

function AdminSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/admin"
      ? pathname === "/admin"
      : pathname === href || pathname.startsWith(href + "/");

  let lastSection: string | undefined = undefined;

  return (
    <nav aria-label="Admin navigation" className="flex flex-col h-full">
      {/* Branding — uses amber accent to signal "you are in admin" */}
      <div className="px-4 py-4 border-b border-amber-800/40 flex-shrink-0 bg-amber-950/20">
        <Link
          href="/admin"
          className="flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded-sm"
          onClick={onNavigate}
        >
          <span className="h-7 w-7 rounded-md bg-amber-500 flex items-center justify-center text-white text-xs font-bold select-none">
            OP
          </span>
          <div>
            <p className="font-semibold text-amber-100 text-sm leading-tight">
              {brand.name}
            </p>
            <p className="text-amber-400 text-2xs font-medium uppercase tracking-wider leading-tight">
              Admin plane
            </p>
          </div>
        </Link>
      </div>

      {/* Nav items */}
      <ul
        className="flex-1 overflow-y-auto py-3 space-y-0.5 px-2"
        role="list"
      >
        {ADMIN_NAV.map((item) => {
          const active = isActive(item.href);
          const showSection = item.section && item.section !== lastSection;
          if (item.section) lastSection = item.section;

          return (
            <li key={item.href}>
              {showSection && (
                <p className="px-3 pt-4 pb-1 text-2xs font-semibold uppercase tracking-wider text-amber-500/70">
                  {item.section}
                </p>
              )}
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400",
                  active
                    ? "bg-amber-500 text-white"
                    : "text-slate-300 hover:bg-slate-700 hover:text-white",
                )}
              >
                <span className="text-base leading-none" aria-hidden>
                  {item.icon}
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>

      {/* Bottom: back to customer dashboard */}
      <div className="px-4 py-3 border-t border-amber-800/40 flex-shrink-0">
        <Link
          href="/overview"
          className="text-xs text-amber-400 hover:text-amber-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded-sm"
        >
          ← Back to customer dashboard
        </Link>
      </div>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Root admin layout
// ---------------------------------------------------------------------------

export default function AdminLayout({ children }: { children: ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    /**
     * Visual differentiation: dark slate sidebar + amber accents signal
     * to the operator that they are in the ADMIN plane, not the customer
     * dashboard. This is an intentional UX safety control.
     */
    <div className="flex h-screen overflow-hidden bg-slate-950">
      {/* Desktop sidebar */}
      <aside
        className="hidden lg:flex w-60 flex-col flex-shrink-0 border-r border-slate-800 bg-slate-900"
        aria-label="Admin sidebar"
      >
        <AdminSidebar />
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileNavOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60 lg:hidden"
            onClick={() => setMobileNavOpen(false)}
            aria-hidden
          />
          <div className="fixed inset-y-0 left-0 z-50 w-60 bg-slate-900 flex flex-col lg:hidden">
            <AdminSidebar onNavigate={() => setMobileNavOpen(false)} />
          </div>
        </>
      )}

      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden bg-slate-950">
        {/* Audit banner — persistent, always visible */}
        <div
          role="banner"
          aria-label="Audit notice"
          className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2 flex items-center gap-3 flex-shrink-0"
        >
          <span
            aria-hidden
            className="text-amber-400 text-sm font-bold select-none"
          >
            ⚠
          </span>
          <p className="text-xs text-amber-300 font-medium">
            <strong>Platform admin plane.</strong> All actions are permanently
            audited. Submission content is hidden by default — explicit
            escalation required.
          </p>
          {/* Mobile menu trigger */}
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open admin navigation"
            className="ml-auto lg:hidden p-1 rounded text-amber-400 hover:text-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            <span aria-hidden className="text-lg leading-none">☰</span>
          </button>
        </div>

        {/* Admin topbar */}
        <header className="h-12 border-b border-slate-800 bg-slate-900 flex items-center px-4 gap-3 flex-shrink-0">
          <span className="text-sm text-slate-400 font-medium">
            Ops Console
          </span>
          <span className="text-slate-700">|</span>
          <span className="text-xs text-slate-500">
            Signed in as{" "}
            <span className="text-amber-400 font-mono">
              {FIXTURE_OPS_EMAIL}
            </span>
          </span>
          <div className="flex-1" />
          <a
            href="/overview"
            className="text-xs text-slate-400 hover:text-slate-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded-sm hidden sm:block"
          >
            ← Customer dashboard
          </a>
        </header>

        {/* Page content */}
        <main
          id="admin-main"
          className="flex-1 overflow-y-auto focus:outline-none text-slate-100"
          tabIndex={-1}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
