/**
 * Next.js Edge Middleware — authentication guard and security headers.
 *
 * This middleware runs on every matched request before the route handler.
 * It has two responsibilities:
 *
 *   1. AUTHENTICATION GUARD: redirect unauthenticated users who attempt to
 *      access protected routes to /login with a `next` param, so they can
 *      return after signing in.
 *
 *   2. SECURITY HEADERS: attach HTTP response headers that defend against
 *      common web vulnerabilities. These are added to EVERY response, not
 *      only auth-protected ones, because they apply to all HTML pages.
 *
 * IMPORTANT — server-side re-check:
 * This middleware is a first-line convenience redirect, not the sole
 * enforcement boundary. Every Server Action and Route Handler that touches
 * sensitive data must also call requireActor() (from @submitpulse/auth),
 * which re-checks the session server-side. Middleware can be bypassed by
 * direct fetch requests to API routes; server-side checks cannot.
 *
 * INCOMPLETE:
 * - Session validation currently checks for the presence of the session
 *   cookie only. In production, the cookie value should be verified
 *   (e.g. supabase.auth.getUser() in the middleware) to prevent use of
 *   expired or revoked tokens. Wire this once @supabase/ssr is installed.
 * - CSP must be tightened once the real asset origins are known (CDNs,
 *   analytics, font providers). The current policy is intentionally strict
 *   and will likely need 'nonce-based' or specific domain allowances.
 */

import { type NextRequest, NextResponse } from "next/server";

/* -------------------------------------------------------------------------- */
/* Protected route prefixes                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Any pathname that starts with one of these prefixes requires authentication.
 * We use startsWith() rather than exact match so nested routes are covered.
 */
const PROTECTED_PREFIXES: readonly string[] = [
  "/overview",
  "/forms",
  "/submissions",
  "/pulse",
  "/integrations",
  "/team",
  "/usage",
  "/billing",
  "/settings",
  "/onboarding",
];

/* -------------------------------------------------------------------------- */
/* Cookie name                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * The session cookie name. __Host- prefix enforces:
 * - Secure flag (HTTPS only)
 * - Path must be "/"
 * - No Domain attribute (bound to exact host)
 *
 * This prevents subdomain-based session fixation attacks.
 *
 * INCOMPLETE: The Supabase SSR helper uses its own cookie names. Align this
 * constant with the name set in the OAuth callback route once both are wired.
 */
const SESSION_COOKIE = "__Host-sp-session";

/* -------------------------------------------------------------------------- */
/* Security header values                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Content-Security-Policy
 *
 * WHY: Prevents XSS attacks by restricting the origins from which the browser
 * will load scripts, styles, images, fonts, and other resources. Even if an
 * attacker injects script tags, CSP prevents them from executing unless the
 * src matches the policy.
 *
 * MUST TIGHTEN BEFORE PRODUCTION:
 * - Replace 'unsafe-inline' for styles with a nonce or hash once the CSS
 *   pipeline is known (Tailwind generates inline styles for some utilities).
 * - Add specific CDN domains instead of 'self' for fonts, analytics, etc.
 * - Add the Supabase project URL to connect-src once the project URL is known.
 * - Consider adding 'strict-dynamic' for script-src once nonces are in place.
 * - Remove 'unsafe-eval' — it is included here only for Next.js dev HMR.
 *   In production builds, Next.js does not need 'unsafe-eval'.
 *
 * Current policy is deliberately restrictive as a baseline; the TODO is to
 * add only what is needed, not to relax broadly.
 */
const CSP = [
  "default-src 'self'",
  // Scripts: self + inline for Next.js hydration. Remove unsafe-eval in prod.
  // TODO: switch to nonce-based approach once asset pipeline is finalised.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  // Styles: self + inline (Tailwind). Replace with nonce when possible.
  "style-src 'self' 'unsafe-inline'",
  // Images: self + data URIs (for Next.js Image placeholders)
  "img-src 'self' data: blob:",
  // Fonts: self only (no external font CDN yet)
  "font-src 'self'",
  // API calls and WebSocket: self + TODO add Supabase project URL
  "connect-src 'self'",
  // Frames: none — we do not embed iframes and do not want to be embedded
  "frame-src 'none'",
  "frame-ancestors 'none'",
  // Media
  "media-src 'self'",
  // Workers
  "worker-src 'self' blob:",
  // Manifests
  "manifest-src 'self'",
  // Block mixed content
  "upgrade-insecure-requests",
]
  .join("; ")
  .trim();

/**
 * HTTP Strict Transport Security
 *
 * WHY: Forces browsers to use HTTPS for all future requests to this origin,
 * even if the user types http:// in the address bar. Protects against SSL
 * stripping attacks. max-age=63072000 = 2 years (HSTS preload minimum).
 * includeSubDomains covers all subdomains. preload opts the domain into the
 * browser HSTS preload list (submit separately at hstspreload.org).
 *
 * NOTE: Only set HSTS on HTTPS responses (Next.js handles this at the infra
 * level in production, but setting it here is belt-and-suspenders).
 */
const HSTS =
  "max-age=63072000; includeSubDomains; preload";

/**
 * X-Content-Type-Options
 *
 * WHY: Prevents browsers from MIME-sniffing a response away from the declared
 * Content-Type. Without this, a browser might execute a text file as
 * JavaScript if an attacker can control the response URL.
 */
const X_CONTENT_TYPE_OPTIONS = "nosniff";

/**
 * Referrer-Policy
 *
 * WHY: Controls how much referrer information the browser sends with requests.
 * `strict-origin-when-cross-origin` sends the full path for same-origin
 * requests but only the origin (no path/query) for cross-origin, preventing
 * leakage of URL-embedded tokens or user identifiers to third-party servers.
 */
const REFERRER_POLICY = "strict-origin-when-cross-origin";

/**
 * Permissions-Policy
 *
 * WHY: Restricts access to browser APIs that could be abused by malicious
 * scripts or iframes. We opt out of everything we don't use.
 *
 * camera, microphone, geolocation: not needed by the app.
 * interest-cohort: disables FLoC/Topics tracking.
 * payment: we redirect to Stripe, never embed payment forms.
 */
const PERMISSIONS_POLICY = [
  "camera=()",
  "microphone=()",
  "geolocation=()",
  "interest-cohort=()",
  "payment=()",
  "usb=()",
  "bluetooth=()",
  "fullscreen=(self)",
].join(", ");

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function hasSession(request: NextRequest): boolean {
  /**
   * INCOMPLETE: Cookie presence is a weak signal — an expired or revoked
   * token still has the cookie set. In production, validate the token
   * against the provider (e.g. supabase.auth.getUser()) here.
   *
   * Edge-compatible validation options:
   * - Decode + verify the JWT locally (public key from Supabase project).
   * - Make a lightweight call to the Supabase auth endpoint.
   * Wire this once @supabase/ssr is installed.
   */
  return !!request.cookies.get(SESSION_COOKIE)?.value;
}

function addSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("Content-Security-Policy", CSP);
  response.headers.set("Strict-Transport-Security", HSTS);
  response.headers.set("X-Content-Type-Options", X_CONTENT_TYPE_OPTIONS);
  response.headers.set("Referrer-Policy", REFERRER_POLICY);
  response.headers.set("Permissions-Policy", PERMISSIONS_POLICY);
  // Belt-and-suspenders X-Frame-Options (redundant with CSP frame-ancestors but
  // supported by older browsers that don't parse CSP frame-ancestors).
  response.headers.set("X-Frame-Options", "DENY");
  return response;
}

/* -------------------------------------------------------------------------- */
/* Middleware                                                                  */
/* -------------------------------------------------------------------------- */

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  if (isProtected(pathname) && !hasSession(request)) {
    /**
     * Redirect unauthenticated users to /login, preserving the intended URL
     * in the `next` query param so the login page can redirect back.
     *
     * The `next` param is URL-encoded to prevent open-redirect attacks.
     * The login page must validate that `next` starts with "/" before
     * using it as a redirect destination.
     */
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname + request.nextUrl.search);
    const redirectResponse = NextResponse.redirect(loginUrl);
    return addSecurityHeaders(redirectResponse);
  }

  // Allow the request through, then add security headers.
  const response = NextResponse.next();
  return addSecurityHeaders(response);
}

/* -------------------------------------------------------------------------- */
/* Route matcher config                                                        */
/* -------------------------------------------------------------------------- */

export const config = {
  /**
   * Run middleware on all routes except:
   * - Next.js internal routes (_next/static, _next/image)
   * - Favicon and other static assets
   * - API routes that need to run without middleware (currently none — all
   *   API routes that need auth enforce it inside the handler itself)
   *
   * We use a negative lookahead to exclude the Next.js internals.
   */
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
