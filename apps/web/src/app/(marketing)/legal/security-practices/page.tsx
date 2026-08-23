/**
 * Security practices overview
 *
 * DRAFT — not legally reviewed. This page describes security practices
 * observationally based on what is designed in the codebase. It makes
 * no certification claims. It must be reviewed before publication to
 * ensure it accurately reflects the deployed system, not just the design.
 *
 * CRITICAL: This page describes DESIGNED practices, not verified ones.
 * The system has never been deployed. None of these controls have been
 * tested in a production environment. A legal reviewer must verify that
 * the description matches reality before this page is published.
 */

import type { Metadata } from "next";
import { brand } from "@submitpulse/config/brand";
import { Card, CardContent, Badge } from "@submitpulse/ui";

export const metadata: Metadata = {
  title: `Security Practices — ${brand.name}`,
  description: `Security practices and controls at ${brand.name}.`,
};

const LAST_UPDATED = "2025-08-23";

export default function SecurityPracticesPage() {
  return (
    <section aria-labelledby="security-heading" className="bg-background py-24">
      <div className="mx-auto max-w-3xl px-6 lg:px-8">

        {/* Draft warning banner */}
        <Card className="mb-10 border-warning/40 bg-warning/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Badge variant="warning" className="shrink-0 mt-0.5">Unreviewed Draft</Badge>
              <div className="text-sm text-text-secondary leading-relaxed">
                <strong className="text-text-primary">
                  This security practices page has not been reviewed by a qualified lawyer or
                  security auditor.
                </strong>{" "}
                It describes security controls as designed in the codebase. The system has not been
                deployed to production. None of the controls below have been verified in a live
                environment. No security audit, penetration test, or third-party review has been
                conducted. No compliance certification (SOC 2, ISO 27001, GDPR, HIPAA) has been
                obtained or applied for. Do not claim certifications that do not exist.
                This page must be reviewed and updated to reflect the actual deployed system
                before it is shown to customers.
              </div>
            </div>
          </CardContent>
        </Card>

        <header className="mb-12">
          <h1 id="security-heading" className="text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
            Security Practices
          </h1>
          <p className="mt-3 text-sm text-text-muted">
            Last updated: <time dateTime={LAST_UPDATED}>{LAST_UPDATED}</time>
          </p>
          <p className="mt-4 text-sm text-text-secondary">
            This page describes the security controls {brand.name} is designed to implement.
            We describe practices observationally. We do not claim certifications we do not hold.
          </p>
        </header>

        <div className="flex flex-col gap-10 text-text-secondary leading-relaxed">

          <div>
            <h2 className="text-base font-semibold text-text-primary mb-3">Data isolation</h2>
            <p className="text-sm mb-3">
              Submission data is isolated by workspace using a three-layer model:
            </p>
            <ul className="text-sm list-disc list-inside space-y-1.5 ml-2">
              <li><strong className="text-text-primary">Permission matrix</strong>: every action is gated by an explicit role-based permission check.</li>
              <li><strong className="text-text-primary">Query scoping</strong>: all database queries are required to filter by workspace ID.</li>
              <li><strong className="text-text-primary">Row Level Security</strong>: Postgres RLS policies enforce tenant isolation at the database level, acting as a backstop when application-layer checks are bypassed by a bug.</li>
            </ul>
            <p className="text-sm mt-3">
              Platform administrators do not have ambient access to tenant submission data.
              Access to customer content requires a documented, audited escalation process.
            </p>
          </div>

          <div>
            <h2 className="text-base font-semibold text-text-primary mb-3">Credential handling</h2>
            <ul className="text-sm list-disc list-inside space-y-1.5 ml-2">
              <li>API keys and invitation tokens are stored as SHA-256 hashes only. Plaintext is shown once at creation and cannot be recovered.</li>
              <li>Webhook payloads are signed with HMAC-SHA256. Signature is included in the <code className="font-mono bg-slate-800 px-1 rounded text-xs">x-submitpulse-signature</code> header.</li>
              <li>Passwords are not stored by {brand.name} — authentication is delegated to Supabase Auth.</li>
              <li>Integration credentials (OAuth tokens, third-party API keys) are designed to be encrypted at rest using envelope encryption. The encryption module is not yet implemented.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-base font-semibold text-text-primary mb-3">Submission security</h2>
            <ul className="text-sm list-disc list-inside space-y-1.5 ml-2">
              <li>Origin checking: form endpoints validate the <code className="font-mono bg-slate-800 px-1 rounded text-xs">Origin</code> request header against a per-form allow-list. Cross-origin submissions from unlisted domains are rejected with 403.</li>
              <li>Rate limiting: per-IP-per-form rate limits are enforced using Upstash Redis. (In development, an in-memory limiter is used.)</li>
              <li>CAPTCHA: Cloudflare Turnstile is supported as an optional bot protection layer. When enabled, the server verifies the token server-side.</li>
              <li>File validation: uploaded files are checked for MIME type via magic bytes (not just the Content-Type header), blocked extensions, double-extension patterns, and size limits.</li>
              <li>Egress safety: the SSRF guard (<code className="font-mono bg-slate-800 px-1 rounded text-xs">safeFetch()</code>) prevents outbound requests to private IP ranges, RFC 1918 addresses, link-local addresses, and cloud metadata endpoints.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-base font-semibold text-text-primary mb-3">Audit logging</h2>
            <p className="text-sm">
              All consequential actions in the system are recorded in an append-only audit log.
              The audit log records: who performed the action (user, API key, system, or support),
              what action was taken, what resource was affected, and a before/after snapshot of
              configuration data (not submission content). The audit log cannot be modified or
              deleted by application code.
            </p>
          </div>

          <div>
            <h2 className="text-base font-semibold text-text-primary mb-3">Transmission security</h2>
            <ul className="text-sm list-disc list-inside space-y-1.5 ml-2">
              <li>All network communication between customers and {brand.name} endpoints uses TLS 1.2 or later, enforced by Cloudflare.</li>
              <li>Outbound webhook deliveries use HTTPS. HTTP-only endpoints are not supported.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-base font-semibold text-text-primary mb-3">Access control</h2>
            <ul className="text-sm list-disc list-inside space-y-1.5 ml-2">
              <li>Four workspace roles: Owner, Admin, Developer, Viewer. Each has a defined permission set that is enforced at the application layer.</li>
              <li>Multi-factor authentication is supported (recorded in <code className="font-mono bg-slate-800 px-1 rounded text-xs">users.mfa_enrolled_at</code>). MFA enforcement at login is not yet implemented.</li>
              <li>Short-lived installation tokens are issued to AI coding agents during setup. These tokens have a limited scope (form configuration read-only), a maximum use count, and an explicit expiry. They cannot access submission data.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-base font-semibold text-text-primary mb-3">Infrastructure</h2>
            <p className="text-sm">
              The form ingestion endpoint runs on Cloudflare Workers at the edge. The dashboard
              and admin interfaces are intended to run on Vercel. The database runs on Supabase
              (Postgres). Data at rest is stored within the hosting provider's infrastructure;
              {brand.name} relies on the provider's storage encryption. Specific encryption
              specifications are those published by Cloudflare and Supabase respectively.
            </p>
          </div>

          <div>
            <h2 className="text-base font-semibold text-text-primary mb-3">Vulnerability disclosure</h2>
            <p className="text-sm">
              If you discover a security vulnerability in {brand.name}, please report it
              responsibly to{" "}
              <a
                href={`mailto:${brand.email.security}`}
                className="text-brand-primary hover:underline"
              >
                {brand.email.security}
              </a>.
              Include a description of the vulnerability, steps to reproduce, and any proof of
              concept. We aim to respond within 48 hours on business days. We ask that you
              give us reasonable time to address the issue before public disclosure.
            </p>
          </div>

          <div>
            <h2 className="text-base font-semibold text-text-primary mb-3">Known limitations</h2>
            <p className="text-sm mb-2">
              We document known security limitations honestly:
            </p>
            <ul className="text-sm list-disc list-inside space-y-1.5 ml-2">
              <li>The SSRF guard has a documented DNS rebinding vulnerability: hostname resolution and fetch are not atomic. This is a known limitation that has not been resolved.</li>
              <li>Integration credential encryption is not yet implemented. Third-party integration credentials should not be stored until this is addressed.</li>
              <li>Row Level Security policies have been authored but have not been tested against a live database. Their correctness has not been verified by a security auditor.</li>
              <li>No penetration test or third-party security audit has been conducted.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-base font-semibold text-text-primary mb-3">No certification claims</h2>
            <p className="text-sm">
              {brand.name} does not hold and does not claim any compliance certification,
              including SOC 2 Type I or II, ISO 27001, GDPR "compliance" (which is not a
              certification but a legal obligation), HIPAA, or PCI DSS.
              We describe our practices so customers can make their own informed assessments.
            </p>
          </div>

        </div>
      </div>
    </section>
  );
}
