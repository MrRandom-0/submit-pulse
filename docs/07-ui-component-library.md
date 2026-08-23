# 07 — UI Component Library

## Overview

The component library lives in `packages/ui/src/`. It is a shared package consumed by `apps/web`. Components are React-based and styled with Tailwind CSS via the preset in `packages/ui/src/tailwind-preset.ts`.

**Status**: Components are defined as TypeScript/TSX source files. They have not been rendered or tested in a browser because the web app has never been built.

## Package structure

```
packages/ui/src/
├── components/
│   ├── badge.tsx
│   ├── button.tsx
│   ├── card.tsx
│   ├── code-block.tsx
│   ├── dialog.tsx
│   ├── empty-state.tsx
│   ├── input.tsx
│   ├── select.tsx
│   ├── skeleton.tsx
│   ├── spinner.tsx
│   ├── status-dot.tsx
│   ├── tabs.tsx
│   ├── toast.tsx
│   └── tooltip.tsx
├── cn.ts              # Class-name merge utility
├── index.ts           # Package exports
├── tailwind-preset.ts # Tailwind configuration
├── theme.css          # CSS custom properties
└── tokens.ts          # Design token definitions
```

## StatusDot

Used throughout the dashboard to indicate health status. The `health_status` Postgres enum has five values: `healthy`, `degraded`, `failing`, `paused`, `setup_incomplete`. The StatusDot component maps these to visual indicators.

## PermissionGate (dashboard component)

Located at `apps/web/src/components/dashboard/PermissionGate.tsx`. Accepts a `permission` prop matching the `Permission` union type from `packages/auth/src/permissions.ts`. Renders children only when the current actor's role grants the permission. Does not render an error state; it renders nothing when the permission is absent, so the UI collapses gracefully.

**Important**: PermissionGate is a client-side rendering shortcut only. Every destructive or privileged action must be re-checked server-side via `requireActor()` in `packages/auth/src/session.ts`.

## CodeBlock

`packages/ui/src/components/code-block.tsx` is used to display the generated integration snippets (from `packages/config/src/snippets.ts`) and integration prompts. It supports copy-to-clipboard.

## Dashboard-specific components

These are in `apps/web/src/components/dashboard/` and are not part of the shared package:

### MetricCard

Displays a single numeric metric with a label and optional trend indicator.

### UsageMeter

Renders a progress bar showing `used / quota`. When `quota` is null (unlimited), the bar is hidden and "Unlimited" is shown.

### ActivityTimeline

Displays the `recentActivity` array from `getOverviewMetrics()`. Each event has a `kind` (one of `submission_received`, `form_created`, `spam_blocked`, `health_incident`, `health_recovered`, `webhook_failed`), a `message`, and a timestamp.

### CopyEndpoint

Displays the form's submission endpoint URL with a copy button. The URL is constructed by `formEndpoint(publicFormId)` from `packages/config/src/brand.ts`.

### SubmissionRow

One row in the submission inbox list. Displays public ID, form name, spam verdict badge, status badge, country code, and timestamp.

### FormCard

One card in the form list. Displays form name, health status dot, submission count, last submission time, and CAPTCHA/origin enforcement badges.
