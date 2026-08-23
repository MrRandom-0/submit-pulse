import type { Metadata } from "next";
import { brand } from "@submitpulse/config/brand";

export const metadata: Metadata = {
  title: `Privacy Policy — ${brand.name}`,
  description: `${brand.name} privacy policy. How we collect, use, and protect your data.`,
};

const LAST_UPDATED = "2025-04-01";

export default function PrivacyPage() {
  return (
    <section aria-labelledby="privacy-heading" className="bg-background py-24">
      <div className="mx-auto max-w-3xl px-6 lg:px-8">
        <header className="mb-12">
          <h1 id="privacy-heading" className="text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
            Privacy Policy
          </h1>
          <p className="mt-3 text-sm text-text-muted">
            Last updated: <time dateTime={LAST_UPDATED}>{LAST_UPDATED}</time>
          </p>
        </header>

        <div className="prose-sm flex flex-col gap-8 text-text-secondary leading-relaxed">
          {[
            {
              heading: "What data we collect",
              body: `We collect account data (name, email address) when you register. We collect form submission data on behalf of customers who have embedded our endpoints on their websites. Submission data is processed and stored according to the configuration chosen by the form owner.

We also collect usage logs, billing information, and support communications.`,
            },
            {
              heading: "How we use your data",
              body: `Account data is used to operate your account, send transactional emails, and provide support. Submission data is used solely to provide the form backend service — it is not analysed, sold, or used for advertising. Usage logs are retained for security and reliability purposes.`,
            },
            {
              heading: "Data storage and retention",
              body: `Data is stored in infrastructure located in the region you select at account creation. Submission data is retained for the period defined by your plan. Deleted submissions are purged from backups within 30 days. You may request deletion of all your data at any time.`,
            },
            {
              heading: "Third-party processors",
              body: `We use a limited set of sub-processors including cloud infrastructure, payment processing, and transactional email providers. A current list is available on request. We do not sell data to third parties.`,
            },
            {
              heading: "Your rights",
              body: `You have the right to access, correct, or delete your personal data at any time. Residents of the EU, UK, and California have additional rights under GDPR, UK GDPR, and CCPA respectively. To exercise any right, contact us at ${brand.email.privacy}.`,
            },
            {
              heading: "Cookies",
              body: `We use cookies for session management and to remember preferences. We do not use third-party advertising cookies. You may disable cookies in your browser; some product features require them to function.`,
            },
            {
              heading: "Contact",
              body: `Privacy questions: ${brand.email.privacy}. Data protection requests: ${brand.email.privacy}. Security issues: ${brand.email.security}.`,
            },
          ].map((section) => (
            <div key={section.heading}>
              <h2 className="text-base font-semibold text-text-primary mb-3">
                {section.heading}
              </h2>
              <p className="text-sm whitespace-pre-line">{section.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
