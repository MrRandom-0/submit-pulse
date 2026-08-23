/**
 * CENTRALISED BRAND DEFINITION — SINGLE SOURCE OF TRUTH
 * ======================================================
 *
 * The product must be renameable before commercial launch without editing
 * hundreds of files. Everything that embeds the product name — UI copy, email
 * subjects, endpoint hostnames, opaque ID prefixes, published npm package
 * names, environment-variable prefixes, support addresses — derives from the
 * `BRAND_SEED` below.
 *
 * TO RENAME THE PRODUCT:
 *   1. Edit `BRAND_SEED` in this file. Nothing else in application code.
 *   2. Run `pnpm brand:verify` (see scripts/verify-brand.ts). It fails the
 *      build if a hardcoded brand literal has leaked into the codebase.
 *   3. Review the migration note under `identifiers` below — ID prefixes are
 *      persisted in the database, so changing `idPrefix` is a DATA migration,
 *      not a cosmetic rename. The verifier treats it as a breaking change.
 *
 * DESIGN RULE ENFORCED BY LINT:
 *   No file outside this module may contain the literal product name.
 *   `eslint-plugin-no-brand-literals` (packages/config/eslint) enforces this.
 */

/** The only place the product name is written down. */
const BRAND_SEED = {
  /** Display name, used in UI chrome, titles, emails. */
  name: "Submit Pulse",
  /** Single-token machine name. Lowercase, no spaces. Used in slugs + env. */
  slug: "submitpulse",
  /** Apex domain the product is served from. */
  apexDomain: "submitpulse.com",
  /** Primary positioning line. */
  tagline: "Forms that never fail silently.",
  /** Secondary positioning line, used on developer-facing surfaces. */
  taglineAlt: "Form infrastructure built for AI-generated websites.",
  description:
    "Submit Pulse gives AI-built and static websites a secure form backend without requiring developers to build server infrastructure.",
  /**
   * Opaque ID prefix for public form identifiers (e.g. fm_a8f3...).
   * WARNING: persisted in the database. Changing this requires a migration.
   */
  idPrefix: "fm",
  /** npm scope for published SDKs. */
  npmScope: "@submitpulse",
  /** Prefix for all product environment variables. */
  envPrefix: "SP",
} as const;

export type BrandSeed = typeof BRAND_SEED;

/**
 * Fully derived brand surface. Import this — never `BRAND_SEED` directly —
 * so that derived values stay consistent after a rename.
 */
export const brand = {
  name: BRAND_SEED.name,
  slug: BRAND_SEED.slug,
  tagline: BRAND_SEED.tagline,
  taglineAlt: BRAND_SEED.taglineAlt,
  description: BRAND_SEED.description,

  domains: {
    apex: BRAND_SEED.apexDomain,
    marketing: `https://${BRAND_SEED.apexDomain}`,
    app: `https://app.${BRAND_SEED.apexDomain}`,
    /** Public ingestion host. Deliberately a separate origin from the app. */
    api: `https://api.${BRAND_SEED.apexDomain}`,
    docs: `https://${BRAND_SEED.apexDomain}/docs`,
    status: `https://status.${BRAND_SEED.apexDomain}`,
  },

  email: {
    /** Transactional sender. */
    from: `noreply@${BRAND_SEED.apexDomain}`,
    support: `support@${BRAND_SEED.apexDomain}`,
    security: `security@${BRAND_SEED.apexDomain}`,
    abuse: `abuse@${BRAND_SEED.apexDomain}`,
    privacy: `privacy@${BRAND_SEED.apexDomain}`,
  },

  identifiers: {
    /**
     * Public, unguessable-but-not-secret form identifier.
     * Documented explicitly as NOT an authentication secret: a public form
     * endpoint is public by definition. Domain rules and bot protection —
     * not ID secrecy — are the access controls.
     */
    form: BRAND_SEED.idPrefix,
    /** Secret credentials. These ARE secrets and are stored hashed. */
    apiKeyLive: `${BRAND_SEED.slug}_live`,
    apiKeyTest: `${BRAND_SEED.slug}_test`,
    /** Short-lived credential issued to an AI coding agent during setup. */
    agentSetupToken: `${BRAND_SEED.slug}_setup`,
    submission: "sub",
    workspace: "ws",
    webhook: "whk",
    incident: "inc",
  },

  packages: {
    browser: `${BRAND_SEED.npmScope}/browser`,
    react: `${BRAND_SEED.npmScope}/react`,
    scope: BRAND_SEED.npmScope,
  },

  env: {
    prefix: BRAND_SEED.envPrefix,
    /** Build a namespaced env var name: envVar("STRIPE_SECRET") -> SP_STRIPE_SECRET */
    var: (name: string): string => `${BRAND_SEED.envPrefix}_${name}`,
    /** Client-exposed vars must additionally carry the framework's public prefix. */
    publicVar: (name: string): string =>
      `NEXT_PUBLIC_${BRAND_SEED.envPrefix}_${name}`,
  },

  /** HTTP + webhook wire constants that embed the brand. */
  wire: {
    /** Signature header on outbound webhooks. */
    signatureHeader: `x-${BRAND_SEED.slug}-signature`,
    timestampHeader: `x-${BRAND_SEED.slug}-timestamp`,
    deliveryIdHeader: `x-${BRAND_SEED.slug}-delivery-id`,
    requestIdHeader: `x-${BRAND_SEED.slug}-request-id`,
    /** Marks a synthetic health-check submission so it can be excluded. */
    syntheticHeader: `x-${BRAND_SEED.slug}-synthetic`,
    userAgent: `${BRAND_SEED.name.replace(/\s+/g, "")}/1.0 (+https://${BRAND_SEED.apexDomain}/bot)`,
  },
} as const;

export type Brand = typeof brand;

/**
 * Build the public submission endpoint for a form.
 * Centralised so the URL shape can change without touching feature code, and
 * so generated AI integration prompts and docs can never drift from reality.
 */
export function formEndpoint(publicFormId: string): string {
  return `${brand.domains.api}/v1/forms/${publicFormId}/submissions`;
}

/** Short display form of an endpoint, for compact UI surfaces. */
export function formEndpointShort(publicFormId: string): string {
  return `${brand.domains.api.replace(/^https:\/\//, "")}/f/${publicFormId}`;
}

export { BRAND_SEED };
