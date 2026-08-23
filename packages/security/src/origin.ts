/**
 * Origin allow-list enforcement.
 *
 * Stored domain entries are normalised (lowercased, no scheme, no path) by the
 * database constraint — see form_domains. Comparison is EXACT so that
 * "evil-example.com" can never match "example.com".
 *
 * Single-label subdomain support: when `includeSubdomains` is true for a host,
 * we match exactly one additional label on the left — "sub.example.com" matches
 * but "deep.sub.example.com" does NOT. This prevents unbounded subdomain trees.
 */

export interface AllowedDomain {
  /** Normalised host, e.g. "example.com". No scheme, no path, no port. */
  readonly host: string;
  /** When true, match exactly one additional subdomain label. */
  readonly includeSubdomains: boolean;
}

export type OriginVerdict =
  | { readonly allowed: true; readonly reason: string }
  | { readonly allowed: false; readonly reason: string };

const LOCALHOST_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "[::1]",
]);

/**
 * Test whether `origin` is permitted by `allowedDomains`.
 *
 * @param origin           The raw `Origin` header value (scheme + host + optional port).
 * @param allowedDomains   Rows from form_domains for this form.
 * @param allowLocalhost   The form's `allow_localhost` flag — permits dev origins.
 */
export function evaluateOrigin(
  origin: string | null | undefined,
  allowedDomains: readonly AllowedDomain[],
  allowLocalhost: boolean,
): OriginVerdict {
  // No Origin header is sent by non-browser clients (curl, server-side fetch).
  // We do not block these — origin enforcement only constrains browser posts.
  if (origin == null || origin === "") {
    return { allowed: true, reason: "no_origin_header" };
  }

  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return { allowed: false, reason: "invalid_origin_format" };
  }

  const scheme = parsed.protocol.replace(/:$/, ""); // "https"
  const host = parsed.hostname.toLowerCase(); // "example.com"
  const port = parsed.port; // "" or "8080"

  // Reconstruct normalised origin for display in errors.
  const normalisedOrigin = port !== "" ? `${scheme}://${host}:${port}` : `${scheme}://${host}`;

  // Dev allowance — localhost on any port and any scheme.
  if (allowLocalhost && LOCALHOST_HOSTS.has(host)) {
    return {
      allowed: true,
      reason: `localhost_dev_mode:${normalisedOrigin}`,
    };
  }

  // Must be HTTPS in production.
  if (scheme !== "https") {
    // We do allow http for localhost when allow_localhost is true (already handled above).
    return {
      allowed: false,
      reason: `non_https_origin:${normalisedOrigin}`,
    };
  }

  for (const entry of allowedDomains) {
    const entryHost = entry.host.toLowerCase();

    // Exact match — the only match for non-subdomain entries.
    if (host === entryHost) {
      return {
        allowed: true,
        reason: `exact_match:${entryHost}`,
      };
    }

    // Single-label subdomain match.
    // host must end with ".<entryHost>" and contain no additional dots
    // in the prefix (so "sub.example.com" yes, "a.b.example.com" no).
    if (entry.includeSubdomains) {
      const suffix = `.${entryHost}`;
      if (host.endsWith(suffix)) {
        const prefix = host.slice(0, host.length - suffix.length);
        // prefix must be non-empty and contain no dots (single label only).
        if (prefix.length > 0 && !prefix.includes(".")) {
          return {
            allowed: true,
            reason: `subdomain_match:${entryHost}`,
          };
        }
      }
    }
  }

  return {
    allowed: false,
    reason: `no_matching_domain:${normalisedOrigin}`,
  };
}

/**
 * Build the `Access-Control-Allow-Origin` header value for a response.
 *
 * Rules:
 *  - If origin is in the allowed list, reflect it back exactly.
 *  - Never emit `*` when credentials may be involved (cookies, auth headers).
 *  - If origin is not allowed, return null (caller should omit the header).
 */
export function buildCorsOriginHeader(
  origin: string | null | undefined,
  allowedDomains: readonly AllowedDomain[],
  allowLocalhost: boolean,
): string | null {
  if (origin == null || origin === "") return null;
  const verdict = evaluateOrigin(origin, allowedDomains, allowLocalhost);
  return verdict.allowed ? origin : null;
}
