/**
 * Acceptable Use Policy
 *
 * DRAFT — not legally reviewed. Do not use in production without qualified
 * legal review appropriate to the jurisdictions where the service operates.
 */

import type { Metadata } from "next";
import { brand } from "@submitpulse/config/brand";
import { Card, CardContent, Badge } from "@submitpulse/ui";

export const metadata: Metadata = {
  title: `Acceptable Use Policy — ${brand.name}`,
  description: `Acceptable use policy for ${brand.name}. What you may and may not do with the service.`,
};

const LAST_UPDATED = "2025-08-23";
const EFFECTIVE_DATE = "To be determined — see draft notice";

export default function AcceptableUsePolicyPage() {
  return (
    <section aria-labelledby="aup-heading" className="bg-background py-24">
      <div className="mx-auto max-w-3xl px-6 lg:px-8">

        {/* Draft warning banner */}
        <Card className="mb-10 border-warning/40 bg-warning/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Badge variant="warning" className="shrink-0 mt-0.5">Unreviewed Draft</Badge>
              <div className="text-sm text-text-secondary leading-relaxed">
                <strong className="text-text-primary">This document has not been reviewed by a qualified lawyer.</strong>{" "}
                It is a working draft that requires legal review before it is suitable for commercial use.
                Do not rely on this document for compliance purposes. Do not represent to customers
                that this policy has been legally reviewed. Contact a qualified attorney familiar with
                SaaS, data protection law, and the jurisdictions in which {brand.name} operates before
                publishing this page publicly.
              </div>
            </div>
          </CardContent>
        </Card>

        <header className="mb-12">
          <h1 id="aup-heading" className="text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
            Acceptable Use Policy
          </h1>
          <p className="mt-3 text-sm text-text-muted">
            Last updated: <time dateTime={LAST_UPDATED}>{LAST_UPDATED}</time>
            {" — "}Effective date: {EFFECTIVE_DATE}
          </p>
        </header>

        <div className="flex flex-col gap-10 text-text-secondary leading-relaxed">

          <div>
            <h2 className="text-base font-semibold text-text-primary mb-3">Purpose</h2>
            <p className="text-sm">
              This Acceptable Use Policy ("AUP") applies to all use of {brand.name} services,
              including the form submission endpoint, dashboard, webhooks, integrations, and APIs.
              By using the service you agree to comply with this policy. This AUP supplements the
              Terms of Service and is incorporated into it by reference.
            </p>
          </div>

          <div>
            <h2 className="text-base font-semibold text-text-primary mb-3">Permitted uses</h2>
            <p className="text-sm mb-3">You may use {brand.name} to:</p>
            <ul className="text-sm list-disc list-inside space-y-1.5 ml-2">
              <li>Collect contact, inquiry, registration, support, and other form submissions from visitors to websites you own or operate.</li>
              <li>Receive notifications about form submissions and deliver them to systems you control.</li>
              <li>Monitor the availability and correctness of form integrations on your websites.</li>
              <li>Build integrations between form submissions and other services using the webhook and integration features.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-base font-semibold text-text-primary mb-3">Prohibited uses</h2>
            <p className="text-sm mb-3">You may not use {brand.name} to:</p>
            <ul className="text-sm list-disc list-inside space-y-2 ml-2">
              <li>Collect personally sensitive data categories (health or medical information, financial account credentials, government-issued identification numbers, biometric data, precise geolocation, or data about minors under 13) without implementing appropriate safeguards, data processing agreements, and obtaining required consents under applicable law.</li>
              <li>Operate phishing forms or fraudulent data collection. Forms must be on websites you legitimately own or operate, and must accurately represent their purpose to visitors.</li>
              <li>Collect data without a lawful basis under applicable privacy law.</li>
              <li>Send unsolicited commercial email using addresses collected through the service.</li>
              <li>Transmit or store malware, exploit code, or any content designed to harm systems or users.</li>
              <li>Circumvent rate limits, abuse detection, CAPTCHA verification, or other technical controls.</li>
              <li>Resell or sublicense access to {brand.name} services without a written agreement.</li>
              <li>Use the service in a way that violates any applicable law or regulation.</li>
              <li>Collect data on behalf of another party (acting as a data processor or sub-processor) without a Data Processing Agreement in place.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-base font-semibold text-text-primary mb-3">Your responsibilities as a form owner</h2>
            <p className="text-sm">
              You are responsible for the forms you operate and the data collected through them.
              This includes: providing a compliant privacy notice to visitors; obtaining required
              consents; ensuring form fields do not solicit information you are not entitled to
              collect; configuring allowed-origin rules to prevent your form endpoint from being
              used by third parties; and complying with applicable data protection law in your
              jurisdiction and in the jurisdictions of your visitors.
            </p>
          </div>

          <div>
            <h2 className="text-base font-semibold text-text-primary mb-3">Enforcement</h2>
            <p className="text-sm">
              {brand.name} may investigate reports of AUP violations. Confirmed violations may
              result in form pausing, workspace suspension, or account termination. We may report
              illegal activity to appropriate authorities. We may act immediately and without
              notice in cases of imminent harm.
            </p>
          </div>

          <div>
            <h2 className="text-base font-semibold text-text-primary mb-3">Reporting violations</h2>
            <p className="text-sm">
              Report suspected AUP violations to{" "}
              <a href={`mailto:${brand.email.abuse}`} className="text-brand-primary hover:underline">
                {brand.email.abuse}
              </a>.
              Include the URL of the form, a description of the suspected violation, and any evidence
              you have. We aim to respond within 48 hours on business days.
            </p>
          </div>

          <div>
            <h2 className="text-base font-semibold text-text-primary mb-3">Changes to this policy</h2>
            <p className="text-sm">
              We may update this AUP at any time. We will notify account holders of material
              changes via email with at least 14 days' notice before the change takes effect.
              Continued use of the service after the effective date constitutes acceptance of the
              updated policy.
            </p>
          </div>

          <div>
            <h2 className="text-base font-semibold text-text-primary mb-3">Contact</h2>
            <p className="text-sm">
              Questions about this policy:{" "}
              <a href={`mailto:${brand.email.support}`} className="text-brand-primary hover:underline">
                {brand.email.support}
              </a>
            </p>
          </div>

        </div>
      </div>
    </section>
  );
}
