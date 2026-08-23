import type { Metadata } from "next";
import { brand } from "@submitpulse/config/brand";

export const metadata: Metadata = {
  title: `Terms of Service — ${brand.name}`,
  description: `${brand.name} terms of service. Your rights and obligations when using the product.`,
};

const LAST_UPDATED = "2025-04-01";

export default function TermsPage() {
  return (
    <section aria-labelledby="terms-heading" className="bg-background py-24">
      <div className="mx-auto max-w-3xl px-6 lg:px-8">
        <header className="mb-12">
          <h1 id="terms-heading" className="text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
            Terms of Service
          </h1>
          <p className="mt-3 text-sm text-text-muted">
            Last updated: <time dateTime={LAST_UPDATED}>{LAST_UPDATED}</time>
          </p>
        </header>

        <div className="flex flex-col gap-8 text-text-secondary leading-relaxed">
          {[
            {
              heading: "Acceptance",
              body: `By creating an account or using ${brand.name} you agree to these Terms. If you are using the service on behalf of an organisation, you represent that you have authority to bind the organisation.`,
            },
            {
              heading: "Service description",
              body: `${brand.name} provides form backend infrastructure including submission receipt, spam filtering, storage, delivery, and monitoring. The service is provided "as is" and may be modified or discontinued at any time with reasonable notice.`,
            },
            {
              heading: "Your responsibilities",
              body: `You are responsible for all content submitted through your form endpoints. You may not use the service to collect data without a lawful basis, to transmit malware, to violate the rights of any person, or for any purpose prohibited by applicable law. You are responsible for maintaining the security of your API keys.`,
            },
            {
              heading: "Prohibited uses",
              body: `The service may not be used to collect sensitive personal data (health, financial, biometric) without appropriate safeguards, to operate phishing or fraudulent forms, to circumvent rate limits or other technical controls, or to resell the service without a written agreement.`,
            },
            {
              heading: "Payment and billing",
              body: `Paid plans are billed monthly or annually in advance. Upgrades are prorated. Downgrades take effect at the next billing cycle. Failure to pay may result in service suspension. Prices may change with 30 days' notice.`,
            },
            {
              heading: "Data and privacy",
              body: `Your submission data is yours. We process it as described in the Privacy Policy. We will not access submission data except to provide the service or as required by law.`,
            },
            {
              heading: "Limitation of liability",
              body: `To the maximum extent permitted by law, ${brand.name} is not liable for indirect, incidental, or consequential damages arising from use or inability to use the service. Our total liability is limited to the amount you paid in the 12 months preceding the claim.`,
            },
            {
              heading: "Termination",
              body: `You may close your account at any time. We may suspend or terminate accounts that violate these Terms. On termination, your data is retained for 30 days for export and then deleted.`,
            },
            {
              heading: "Governing law",
              body: `These Terms are governed by the laws of the jurisdiction in which ${brand.name} is incorporated, without regard to conflict of law provisions.`,
            },
            {
              heading: "Contact",
              body: `Questions about these Terms: ${brand.email.support}. Legal notices: ${brand.email.support}.`,
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
