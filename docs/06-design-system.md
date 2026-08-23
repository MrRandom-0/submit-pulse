# 06 — Design System

## Source of truth

Design tokens are defined in `packages/ui/src/tokens.ts`. The Tailwind preset is in `packages/ui/src/tailwind-preset.ts`. CSS custom properties are in `packages/ui/src/theme.css`.

The design system package exports to `packages/ui/src/index.ts`.

## Status

The design system is defined in code. It has not been rendered in a browser because the web app has never been built (no `node_modules`).

## Color tokens

Inferred from `packages/ui/src/tokens.ts` and `packages/ui/src/theme.css`. The specific values require reading the token file directly; they are not reproduced here to avoid any drift between this document and the source.

The system uses CSS custom properties on `:root` for light mode and a `[data-theme="dark"]` selector for dark mode. Components reference tokens via Tailwind utility classes defined in the preset.

## Typography

Font families, weights, and scale steps are defined in the Tailwind preset. The system follows a modular scale.

## Spacing

Spacing follows the Tailwind default 4px base grid extended in the preset.

## Component inventory

Components are in `packages/ui/src/components/`:

| Component | File | Notes |
|---|---|---|
| Button | `button.tsx` | Variants: primary, secondary, destructive, ghost |
| Card | `card.tsx` | Container with border and shadow |
| Badge | `badge.tsx` | Status and label indicators |
| Spinner | `spinner.tsx` | Loading indicator |
| Skeleton | `skeleton.tsx` | Loading placeholder |
| StatusDot | `status-dot.tsx` | Health/status indicator dot |
| EmptyState | `empty-state.tsx` | Zero-state placeholder |
| Input | `input.tsx` | Form input |
| Select | `select.tsx` | Dropdown select |
| Tabs | `tabs.tsx` | Tab navigation |
| Dialog | `dialog.tsx` | Modal dialog |
| Tooltip | `tooltip.tsx` | Hover tooltip |
| Toast | `toast.tsx` | Transient notification |
| CodeBlock | `code-block.tsx` | Syntax-highlighted code display |

Dashboard-specific components are in `apps/web/src/components/dashboard/`:

| Component | Purpose |
|---|---|
| `MetricCard.tsx` | Summary metric display |
| `UsageMeter.tsx` | Quota usage bar |
| `ActivityTimeline.tsx` | Recent activity feed |
| `CopyEndpoint.tsx` | Endpoint URL with copy button |
| `SubmissionRow.tsx` | Inbox list row |
| `FormCard.tsx` | Form list card |
| `PermissionGate.tsx` | Role-conditional rendering |

## PermissionGate

`apps/web/src/components/dashboard/PermissionGate.tsx` wraps UI elements that require specific permissions. It accepts a `permission` prop and renders children only when the actor's role grants it. This is a UX convenience; server-side permission checks in Server Actions are the actual enforcement boundary.

## Utilities

`packages/ui/src/cn.ts` exports a `cn()` helper (class-name merger, wrapping `clsx` and `tailwind-merge`). This is the only dependency on external npm packages that the UI layer exposes directly.
