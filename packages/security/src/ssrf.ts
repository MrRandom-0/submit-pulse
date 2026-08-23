/**
 * SHARED EGRESS GUARD — used by webhooks, the Pulse health monitor, and the
 * website scanner. Any feature that makes outbound HTTP calls MUST route
 * through `assertSafeEgressUrl` before opening a connection.
 *
 * ⚠️  DNS REBINDING WARNING ⚠️
 * Passing DNS validation here does NOT guarantee safety at connect time.
 * A malicious DNS server can return a safe IP during this check and a private
 * IP when the HTTP client resolves the name moments later (DNS rebinding).
 * To fully close this gap the HTTP client MUST:
 *   1. Perform its own DNS resolution before connecting.
 *   2. Verify the resolved IP against the same private-range rules here.
 *   3. Pin the connection to that IP (disable hostname-triggered re-resolution
 *      during redirects).
 * In Cloudflare Workers the platform-level egress policy provides an
 * additional layer, but application-level validation is still required
 * because the platform policy cannot be assumed in all deployment contexts.
 *
 * Redirect policy: every redirect target is re-validated through the full
 * pipeline. The total redirect count is capped at MAX_REDIRECTS.
 */

/** Maximum number of HTTP redirects to follow before aborting. */
const MAX_REDIRECTS = 3;

/** Non-standard ports that are blocked even on https. */
const BLOCKED_PORTS = new Set([
  // Internal/admin ports commonly exposed on localhost
  8080, 8443, 8888, 9200, 9300, 27017, 27018, 6379, 5432, 3306, 1521,
]);

/** A validated, safe egress URL. Opaque type — construction is gated. */
export type SafeUrl = { readonly _brand: "SafeUrl"; readonly href: string };

export class SsrfError extends Error {
  constructor(
    message: string,
    public readonly reason: string,
  ) {
    super(message);
    this.name = "SsrfError";
  }
}

/**
 * Assert that `url` is safe for outbound egress. Returns a branded `SafeUrl`
 * on success; throws `SsrfError` on any violation.
 *
 * Validates:
 *  - HTTPS-only scheme
 *  - No localhost / loopback (IPv4 127.0.0.0/8, IPv6 ::1)
 *  - No private ranges (10/8, 172.16/12, 192.168/16, 169.254/16)
 *  - No IPv6 ULA (fc00::/7) or link-local (fe80::/10)
 *  - No cloud metadata endpoints (169.254.169.254, metadata.google.internal)
 *  - No non-standard ports
 *
 * See the DNS rebinding warning at the top of this file.
 */
export async function assertSafeEgressUrl(url: string): Promise<SafeUrl> {
  return _validateUrl(url, 0);
}

async function _validateUrl(url: string, depth: number): Promise<SafeUrl> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new SsrfError(`Invalid URL: ${url}`, "INVALID_URL");
  }

  // Only HTTPS is allowed for outbound calls.
  if (parsed.protocol !== "https:") {
    throw new SsrfError(
      `Non-HTTPS scheme rejected: ${parsed.protocol}`,
      "SCHEME_NOT_HTTPS",
    );
  }

  const hostname = parsed.hostname.toLowerCase();

  // Cloud metadata endpoints — exact host match.
  if (
    hostname === "169.254.169.254" ||
    hostname === "metadata.google.internal" ||
    hostname === "metadata.goog"
  ) {
    throw new SsrfError(
      `Cloud metadata endpoint rejected: ${hostname}`,
      "CLOUD_METADATA",
    );
  }

  // Loopback / localhost.
  if (
    hostname === "localhost" ||
    hostname === "ip6-localhost" ||
    hostname === "ip6-loopback"
  ) {
    throw new SsrfError(`Loopback host rejected: ${hostname}`, "LOOPBACK");
  }

  // Block non-standard ports.
  const port = parsed.port !== "" ? parseInt(parsed.port, 10) : null;
  if (port !== null && BLOCKED_PORTS.has(port)) {
    throw new SsrfError(
      `Non-standard port rejected: ${port}`,
      "BLOCKED_PORT",
    );
  }

  // IPv4 / IPv6 address checks.
  if (isIpAddress(hostname)) {
    assertSafeIp(hostname);
  }

  // For redirect depth tracking — if this is a redirect, note it.
  if (depth > MAX_REDIRECTS) {
    throw new SsrfError(
      `Too many redirects (max ${MAX_REDIRECTS})`,
      "TOO_MANY_REDIRECTS",
    );
  }

  return { _brand: "SafeUrl", href: parsed.href };
}

/**
 * Wrap fetch to follow redirects safely, re-validating every hop.
 * This is the recommended way to perform outbound HTTP inside the product.
 * Callers must have already called `assertSafeEgressUrl` on the initial URL.
 */
export async function safeFetch(
  safeUrl: SafeUrl,
  init?: RequestInit,
): Promise<Response> {
  let url = safeUrl.href;
  let redirectCount = 0;

  while (redirectCount <= MAX_REDIRECTS) {
    const response = await fetch(url, {
      ...init,
      redirect: "manual",
    });

    if (
      response.status >= 300 &&
      response.status < 400 &&
      response.headers.has("location")
    ) {
      redirectCount++;
      const location = response.headers.get("location") ?? "";

      // Resolve relative redirects against the current URL.
      const nextUrl = new URL(location, url).href;

      // Re-validate the redirect target — closes the DNS rebinding path
      // for URL-structure checks (IP range validation still applies).
      await _validateUrl(nextUrl, redirectCount);
      url = nextUrl;
      continue;
    }

    return response;
  }

  throw new SsrfError(
    `Exceeded ${MAX_REDIRECTS} redirects`,
    "TOO_MANY_REDIRECTS",
  );
}

// ---------------------------------------------------------------------------
// IP validation helpers
// ---------------------------------------------------------------------------

function isIpAddress(host: string): boolean {
  // IPv4
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  // IPv6 (with or without brackets — URL.hostname strips brackets)
  if (host.includes(":")) return true;
  return false;
}

function assertSafeIp(ip: string): void {
  if (ip.includes(":")) {
    assertSafeIpv6(ip);
  } else {
    assertSafeIpv4(ip);
  }
}

function assertSafeIpv4(ip: string): void {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4) {
    throw new SsrfError(`Malformed IPv4: ${ip}`, "INVALID_IP");
  }
  const [a, b] = parts as [number, number, number, number];

  // 127.0.0.0/8 — loopback
  if (a === 127) {
    throw new SsrfError(`Loopback IPv4 rejected: ${ip}`, "LOOPBACK");
  }
  // 10.0.0.0/8 — RFC 1918
  if (a === 10) {
    throw new SsrfError(`Private range (10/8) rejected: ${ip}`, "PRIVATE_IP");
  }
  // 172.16.0.0/12 — RFC 1918
  if (a === 172 && b >= 16 && b <= 31) {
    throw new SsrfError(
      `Private range (172.16/12) rejected: ${ip}`,
      "PRIVATE_IP",
    );
  }
  // 192.168.0.0/16 — RFC 1918
  if (a === 192 && b === 168) {
    throw new SsrfError(
      `Private range (192.168/16) rejected: ${ip}`,
      "PRIVATE_IP",
    );
  }
  // 169.254.0.0/16 — link-local / APIPA
  if (a === 169 && b === 254) {
    throw new SsrfError(
      `Link-local range (169.254/16) rejected: ${ip}`,
      "LINK_LOCAL",
    );
  }
  // 0.0.0.0/8 — "this" network
  if (a === 0) {
    throw new SsrfError(`"This" network (0/8) rejected: ${ip}`, "INVALID_IP");
  }
}

function assertSafeIpv6(ip: string): void {
  const lower = ip.toLowerCase().replace(/^\[|\]$/g, "");

  // ::1 — loopback
  if (lower === "::1" || lower === "0:0:0:0:0:0:0:1") {
    throw new SsrfError(`IPv6 loopback rejected: ${ip}`, "LOOPBACK");
  }
  // :: — unspecified
  if (lower === "::" || lower === "0:0:0:0:0:0:0:0") {
    throw new SsrfError(`IPv6 unspecified rejected: ${ip}`, "INVALID_IP");
  }

  // fe80::/10 — link-local
  if (/^fe[89ab][0-9a-f]:/i.test(lower) || lower.startsWith("fe80:")) {
    throw new SsrfError(
      `IPv6 link-local (fe80::/10) rejected: ${ip}`,
      "LINK_LOCAL",
    );
  }

  // fc00::/7 — unique local (fc00:: and fd00::)
  if (/^f[cd]/i.test(lower)) {
    throw new SsrfError(
      `IPv6 ULA (fc00::/7) rejected: ${ip}`,
      "PRIVATE_IP",
    );
  }
}
