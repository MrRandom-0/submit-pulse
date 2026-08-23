"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Button,
  Tooltip,
  TooltipProvider,
  cn,
} from "@submitpulse/ui";
import { brand } from "@submitpulse/config";
import type { ReactNode } from "react";

// ---------------------------------------------------------------------------
// Navigation items
// ---------------------------------------------------------------------------

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/overview", label: "Overview", icon: "⊞" },
  { href: "/forms", label: "Forms", icon: "◻" },
  { href: "/submissions", label: "Submissions", icon: "◫" },
  { href: "/pulse", label: "Pulse", icon: "♡" },
  { href: "/integrations", label: "Integrations", icon: "⇄" },
  { href: "/team", label: "Team", icon: "◈" },
  { href: "/usage", label: "Usage", icon: "◷" },
  { href: "/billing", label: "Billing", icon: "◇" },
  { href: "/settings", label: "Settings", icon: "⚙" },
];

// Stub workspaces for the workspace selector
const WORKSPACES = [
  { id: "ws-1", name: "Acme Corp", isClient: false },
  { id: "ws-2", name: "Client: Widgets Inc", isClient: true },
  { id: "ws-3", name: "Client: Globex", isClient: true },
];

// ---------------------------------------------------------------------------
// Sidebar component
// ---------------------------------------------------------------------------

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    // Match /overview → active when pathname is /overview or /overview/*
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <nav aria-label="Dashboard navigation" className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-border flex-shrink-0">
        <Link
          href="/overview"
          className="flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring rounded-sm"
          onClick={onNavigate}
        >
          <span className="h-7 w-7 rounded-md bg-primary flex items-center justify-center text-white text-sm font-bold select-none">
            SP
          </span>
          <span className="font-semibold text-text-primary text-sm">
            {brand.name}
          </span>
        </Link>
      </div>

      {/* Nav items */}
      <ul className="flex-1 overflow-y-auto py-3 space-y-0.5 px-2" role="list">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring",
                  active
                    ? "bg-primary text-white"
                    : "text-text-secondary hover:bg-surface hover:text-text-primary",
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

      {/* Bottom workspace indicator */}
      <div className="px-4 py-3 border-t border-border flex-shrink-0">
        <div className="text-2xs text-text-muted uppercase tracking-wide mb-1 font-medium">
          Workspace
        </div>
        <div className="text-sm font-medium text-text-primary truncate">
          {WORKSPACES[0]?.name ?? "—"}
        </div>
        <div className="text-xs text-text-muted mt-0.5">Pro plan</div>
      </div>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Topbar
// ---------------------------------------------------------------------------

function Topbar({ onMobileMenuOpen }: { onMobileMenuOpen: () => void }) {
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  return (
    <header className="h-14 border-b border-border bg-background flex items-center px-4 gap-3 flex-shrink-0">
      {/* Mobile menu trigger */}
      <button
        type="button"
        onClick={onMobileMenuOpen}
        aria-label="Open navigation menu"
        className="lg:hidden p-1.5 rounded-md text-text-secondary hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
      >
        <span aria-hidden className="text-lg leading-none">☰</span>
      </button>

      {/* Workspace selector */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setWorkspaceMenuOpen((v) => !v)}
          aria-expanded={workspaceMenuOpen}
          aria-haspopup="listbox"
          aria-label="Switch workspace"
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium border border-border",
            "text-text-primary bg-background hover:bg-surface transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring",
          )}
        >
          <span className="truncate max-w-[140px]">
            {WORKSPACES[0]?.name ?? "Select workspace"}
          </span>
          <span aria-hidden className="text-text-muted">▾</span>
        </button>
        {workspaceMenuOpen && (
          <>
            <div
              className="fixed inset-0 z-dropdown"
              onClick={() => setWorkspaceMenuOpen(false)}
              aria-hidden
            />
            <ul
              role="listbox"
              aria-label="Workspaces"
              className="absolute top-full left-0 mt-1 z-dropdown bg-surface-elevated border border-border rounded-md shadow-elevated min-w-[180px] py-1"
            >
              {WORKSPACES.map((ws) => (
                <li key={ws.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={ws.id === "ws-1"}
                    className="w-full text-left px-3 py-2 text-sm text-text-primary hover:bg-surface focus-visible:outline-none focus-visible:bg-surface"
                    onClick={() => setWorkspaceMenuOpen(false)}
                  >
                    {ws.name}
                    {ws.isClient && (
                      <span className="ml-2 text-2xs text-text-muted">Client</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {/* Global search */}
      <div className="flex-1 max-w-sm relative hidden sm:block">
        <label htmlFor="global-search" className="sr-only">
          Search submissions and forms
        </label>
        <input
          id="global-search"
          type="search"
          placeholder="Search…"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          className={cn(
            "w-full h-8 pl-8 pr-3 text-sm rounded-input border border-border bg-background",
            "text-text-primary placeholder:text-text-muted",
            "focus:outline-none focus:ring-2 focus:ring-focus-ring",
          )}
        />
        <span
          aria-hidden
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted text-sm"
        >
          ⌕
        </span>
      </div>

      <div className="flex-1" />

      {/* Notifications */}
      <TooltipProvider>
        <Tooltip content="Notifications">
          <button
            type="button"
            onClick={() => setNotificationsOpen((v) => !v)}
            aria-label="Notifications"
            aria-haspopup="dialog"
            className={cn(
              "p-2 rounded-md text-text-secondary hover:bg-surface transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring",
              "relative",
            )}
          >
            <span aria-hidden className="text-base leading-none">🔔</span>
            {/* Unread badge */}
            <span className="absolute top-1 right-1 h-2 w-2 bg-danger rounded-full" aria-label="Unread notifications" />
          </button>
        </Tooltip>

        {/* Help */}
        <Tooltip content="Help & docs">
          <a
            href={brand.domains.docs}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open documentation"
            className={cn(
              "p-2 rounded-md text-text-secondary hover:bg-surface transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring",
            )}
          >
            <span aria-hidden className="text-base leading-none">?</span>
          </a>
        </Tooltip>
      </TooltipProvider>

      {/* User menu */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setUserMenuOpen((v) => !v)}
          aria-expanded={userMenuOpen}
          aria-haspopup="menu"
          aria-label="User menu"
          className={cn(
            "flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-surface transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring",
          )}
        >
          <span className="h-7 w-7 rounded-full bg-primary/20 text-primary text-sm font-semibold flex items-center justify-center select-none">
            AJ
          </span>
          <span className="text-sm font-medium text-text-primary hidden md:block">
            Alice
          </span>
        </button>
        {userMenuOpen && (
          <>
            <div
              className="fixed inset-0 z-dropdown"
              onClick={() => setUserMenuOpen(false)}
              aria-hidden
            />
            <div
              role="menu"
              className="absolute right-0 top-full mt-1 z-dropdown bg-surface-elevated border border-border rounded-md shadow-elevated min-w-[180px] py-1"
            >
              <div className="px-3 py-2 border-b border-border">
                <p className="text-sm font-medium text-text-primary">Alice Johnson</p>
                <p className="text-xs text-text-muted">alice@example.com</p>
              </div>
              <Link
                href="/settings"
                role="menuitem"
                className="flex items-center px-3 py-2 text-sm text-text-primary hover:bg-surface focus-visible:outline-none focus-visible:bg-surface"
                onClick={() => setUserMenuOpen(false)}
              >
                Settings
              </Link>
              <Link
                href="/billing"
                role="menuitem"
                className="flex items-center px-3 py-2 text-sm text-text-primary hover:bg-surface focus-visible:outline-none focus-visible:bg-surface"
                onClick={() => setUserMenuOpen(false)}
              >
                Billing
              </Link>
              <hr className="my-1 border-border" />
              <button
                type="button"
                role="menuitem"
                className="w-full text-left px-3 py-2 text-sm text-danger hover:bg-surface focus-visible:outline-none focus-visible:bg-surface"
                onClick={() => {
                  // Stub: would call signOut()
                  setUserMenuOpen(false);
                }}
              >
                Sign out
              </button>
            </div>
          </>
        )}
      </div>

      {/* Notifications panel (stub) */}
      <Dialog open={notificationsOpen} onOpenChange={setNotificationsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Notifications</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-text-muted py-4 text-center">
            No new notifications.
          </p>
          <div className="flex justify-end">
            <Button variant="secondary" size="sm" onClick={() => setNotificationsOpen(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Root layout
// ---------------------------------------------------------------------------

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <aside
        className="hidden lg:flex w-56 flex-col flex-shrink-0 border-r border-border bg-background"
        aria-label="Sidebar"
      >
        <SidebarContent />
      </aside>

      {/* Mobile sidebar (Dialog/sheet) */}
      <Dialog open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <DialogContent className="lg:hidden p-0 max-w-[260px] h-full rounded-none">
          <DialogHeader className="sr-only">
            <DialogTitle>Navigation</DialogTitle>
          </DialogHeader>
          <div className="h-full">
            <SidebarContent onNavigate={() => setMobileNavOpen(false)} />
          </div>
        </DialogContent>
      </Dialog>

      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Topbar onMobileMenuOpen={() => setMobileNavOpen(true)} />
        <main
          id="main-content"
          className="flex-1 overflow-y-auto focus:outline-none"
          tabIndex={-1}
        >
          {/* Skip link target */}
          <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-toast focus:px-4 focus:py-2 focus:bg-primary focus:text-white">
            Skip to main content
          </a>
          {children}
        </main>
      </div>
    </div>
  );
}
