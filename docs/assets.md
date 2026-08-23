# Assets

## Asset provenance policy

All visual assets used in Submit Pulse must have a documented provenance before appearing in any deployed surface. This document tracks asset origins and usage rights.

## Permitted asset sources

1. **AI-generated images**: Generated using approved generation tools. Prompts are documented in `docs/image-prompts.md`. AI-generated images are used under the terms of the generation service used.

2. **Self-created graphics**: Diagrams, wireframes, and illustrations produced directly by the team using design tools. No third-party rights.

3. **Licensed stock**: Images licensed from stock providers (Unsplash, Adobe Stock, etc.) with a record of the license type and the source URL.

4. **Open-source icons**: Icon libraries with MIT or equivalent permissive license (e.g. Heroicons, Phosphor Icons, Lucide).

## Prohibited without explicit documentation

- Scraped or downloaded images from external sites without license verification.
- Images containing third-party logos, brand marks, or recognisable individuals without consent.
- Screenshots of third-party products used in marketing materials without permission.

## Current asset inventory

No production assets have been created or deployed. The marketing pages in `apps/web/src/app/(marketing)/` are Next.js pages. No image files exist in any `public/` directory. Social sharing metadata (og:image, twitter:card) references placeholder URLs.

No logo file exists in the repository.

## Brand constants

The brand module (`packages/config/src/brand.ts`) is the single source of truth for all product identifiers. It is the only file in the codebase that contains the literal product name. All other files derive identifiers from the `brand` export.

| Constant | Value |
|---|---|
| `brand.name` | Submit Pulse |
| `brand.slug` | submitpulse |
| `brand.tagline` | "Forms that never fail silently." |
| `brand.domains.apex` | submitpulse.com |
| `brand.domains.app` | https://app.submitpulse.com |
| `brand.domains.api` | https://api.submitpulse.com |
| `brand.email.support` | support@submitpulse.com |
| `brand.email.security` | security@submitpulse.com |
| `brand.email.privacy` | privacy@submitpulse.com |
| `brand.email.abuse` | abuse@submitpulse.com |

## Builder registry and third-party marks

The builder profiles in `packages/config/src/builders.ts` include a module-level comment:

> "IMPORTANT — no partnership is implied. These are tools our users build with. Marketing copy must say 'Works with websites built using…', never imply an official integration or endorsement."

Logos or trademarks for Lovable, Bolt, v0, Cursor, Claude Code, Codex, Replit, Framer, Webflow, or any other builder must not appear in marketing materials without explicit written permission from the respective trademark holders.

## Wire constants

HTTP headers that embed the brand name are generated from `brand.wire` in `packages/config/src/brand.ts`:

| Header | Value |
|---|---|
| Signature | `x-submitpulse-signature` |
| Timestamp | `x-submitpulse-timestamp` |
| Delivery ID | `x-submitpulse-delivery-id` |
| Request ID | `x-submitpulse-request-id` |
| Synthetic flag | `x-submitpulse-synthetic` |

These values must not be hardcoded in documentation or code — always reference `brand.wire.*`.
