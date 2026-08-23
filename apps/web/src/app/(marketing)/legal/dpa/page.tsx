/**
 * Data Processing Agreement (DPA)
 *
 * DRAFT — not legally reviewed. Do not use in production without qualified
 * legal review. GDPR, UK GDPR, and CCPA requirements vary by jurisdiction
 * and use case. This document requires review by a qualified lawyer.
 */

import type { Metadata } from "next";
import { brand } from "@submitpulse/config/brand";
import { Card, CardContent, Badge } from "@submitpulse/ui";

export const metadata: Metadata = {
  title: `Data Processing Agreement — ${brand.name}`,
  description: `Data Processing Agreement for ${brand.name}. Governs the processing of personal data on behalf of customers.`,
};

const LAST_UPDATED = "2025-08-23";
const EFFECTIVE_DATE = "To be determined — see draft notice";

export default function DpaPage() {
  return (
    <section aria-labelledby="dpa-heading" className="bg-background py-24">
      <div className="mx-auto max-w-3xl px-6 lg:px-8">

        {/* Draft warning banner */}
        <Card className="mb-10 border-warning/40 bg-warning/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Badge variant="warning" className="shrink-0 mt-0.5">Unreviewed Draft</Badge>
              <div className="text-sm text-text-secondary leading-relaxed">
                <strong className="text-text-primary">
                  This Data Processing Agreement has not been reviewed by a qualified lawyer.
                </strong>{" "}
                A DPA that governs GDPR-regulated data processing has significant legal and operational
                consequences. This draft must be reviewed by a qualified lawyer before it is offered
                to any customer. Standard Contractual Clauses (SCCs), UK Addendum, and jurisdiction-
                specific annexes may be required depending on where your customers and their end-users
                are located. Do not represent to customers that this DPA is legally valid until it
                has been reviewed and signed off by legal counsel.
              </div>
            </div>
          </CardContent>
        </Card>

        <header className="mb-12">
          <h1 id="dpa-heading" className="text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
            Data Processing Agreement
          </h1>
          <p className="mt-3 text-sm text-text-muted">
            Last updated: <time dateTime={LAST_UPDATED}>{LAST_UPDATED}</time>
            {" — "}Effective date: {EFFECTIVE_DATE}
          </p>
          <p className="mt-4 text-sm text-text-secondary">
            This Data Processing Agreement ("DPA") is entered into between {brand.name} ("Processor")
            and the customer entity that has agreed to the Terms of Service ("Controller"). This DPA
            is incorporated into and forms part of the Terms of Service.
          </p>
        </header>

        <div className="flex flex-col gap-10 text-text-secondary leading-relaxed">

          <div>
            <h2 className="text-base font-semibold text-text-primary mb-3">1. Definitions</h2>
            <div className="text-sm space-y-2">
              <p>"Personal Data", "Data Subject", "Processing", "Controller", "Processor", and "Sub-processor" have the meanings given in applicable data protection law, including the EU General Data Protection Regulation (GDPR) and the UK GDPR.</p>
              <p>"Customer Data" means personal data that the Controller submits to, or causes to be processed by, the {brand.name} service.</p>
              <p>"Applicable Data Protection Law" means, as relevant to the Controller: the EU GDPR (Regulation 2016/679); the UK GDPR and Data Protection Act 2018; applicable member state or national implementing legislation; and any successor legislation.</p>
            </div>
          </div>

          <div>
            <h2 className="text-base font-semibold text-text-primary mb-3">2. Scope and role</h2>
            <p className="text-sm">
              {brand.name} acts as a Processor of Customer Data on behalf of the Controller.
              The Controller determines the purposes and means of processing. The Controller is
              responsible for ensuring it has a lawful basis for collecting and directing the
              processing of Customer Data, and for providing required notices to Data Subjects.
            </p>
          </div>

          <div>
            <h2 className="text-base font-semibold text-text-primary mb-3">3. Subject matter, nature, purpose, and duration of processing</h2>
            <div className="text-sm space-y-2">
              <p><strong className="text-text-primary">Subject matter</strong>: Form submission data and related metadata submitted through {brand.name} endpoints on behalf of the Controller.</p>
              <p><strong className="text-text-primary">Nature of processing</strong>: Collection, storage, transmission to configured destinations (email, webhooks, integrations), spam analysis, and deletion according to the retention policy.</p>
              <p><strong className="text-text-primary">Purpose</strong>: To provide the form backend service described in the Terms of Service.</p>
              <p><strong className="text-text-primary">Duration</strong>: For the term of the Controller's subscription. Following termination, Customer Data is retained for 30 days for export, then deleted.</p>
              <p><strong className="text-text-primary">Categories of data</strong>: Whatever personal data the Controller chooses to collect via their forms. The Processor does not dictate or restrict field types.</p>
            </div>
          </div>

          <div>
            <h2 className="text-base font-semibold text-text-primary mb-3">4. Processor obligations</h2>
            <ul className="text-sm list-disc list-inside space-y-2 ml-2">
              <li>Process Customer Data only on the Controller's documented instructions (as represented by the service configuration) and as required by applicable law.</li>
              <li>Ensure that persons authorised to process Customer Data are subject to appropriate confidentiality obligations.</li>
              <li>Implement appropriate technical and organisational security measures against unauthorised or unlawful processing and against accidental loss, destruction, or damage.</li>
              <li>Not engage Sub-processors without the Controller's general written authorisation (given by accepting this DPA) and subject to the conditions in Section 6.</li>
              <li>Assist the Controller in responding to Data Subject requests, and in meeting other Controller obligations under applicable data protection law, to the extent reasonably possible given the nature of the processing.</li>
              <li>Notify the Controller of a personal data breach without undue delay after becoming aware of it, at: {brand.email.security}.</li>
              <li>Delete or return all Customer Data at the end of the service term, at the Controller's election.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-base font-semibold text-text-primary mb-3">5. Controller obligations</h2>
            <ul className="text-sm list-disc list-inside space-y-2 ml-2">
              <li>Ensure a lawful basis for processing exists before directing {brand.name} to collect Personal Data.</li>
              <li>Provide compliant privacy notices to Data Subjects.</li>
              <li>Not instruct {brand.name} to process Personal Data in violation of applicable law.</li>
              <li>Ensure that any special category data (health, biometric, etc.) is not collected without appropriate safeguards.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-base font-semibold text-text-primary mb-3">6. Sub-processors</h2>
            <p className="text-sm mb-3">
              {brand.name} uses sub-processors to provide the service. A current list is maintained
              at{" "}
              <a href="/legal/subprocessors" className="text-brand-primary hover:underline">
                {brand.domains.apex}/legal/subprocessors
              </a>.
              By accepting this DPA, the Controller provides general authorisation for the use of
              sub-processors listed there. {brand.name} will notify the Controller of material changes
              to the sub-processor list with at least 30 days' advance notice.
            </p>
            <p className="text-sm">
              {brand.name} will impose data protection obligations on Sub-processors equivalent to
              those in this DPA, and remains liable to the Controller for Sub-processor acts and omissions.
            </p>
          </div>

          <div>
            <h2 className="text-base font-semibold text-text-primary mb-3">7. International transfers</h2>
            <p className="text-sm">
              Customer Data may be transferred to, and processed in, countries outside the European
              Economic Area or the United Kingdom. Where such transfers occur, {brand.name} will
              ensure an appropriate transfer mechanism is in place (such as Standard Contractual
              Clauses). The specific transfer mechanisms applicable to each sub-processor are
              documented in the sub-processor list. Standard Contractual Clauses are not yet
              attached to this draft — this must be addressed before this DPA is suitable for use
              with EU or UK customers.
            </p>
          </div>

          <div>
            <h2 className="text-base font-semibold text-text-primary mb-3">8. Audit rights</h2>
            <p className="text-sm">
              Upon written request with at least 30 days' notice, and no more than once per 12-month
              period, {brand.name} will make available information reasonably necessary to demonstrate
              compliance with this DPA. The Controller may conduct or commission an audit of processing
              facilities at its own cost, subject to reasonable conditions protecting confidentiality
              and operational continuity.
            </p>
          </div>

          <div>
            <h2 className="text-base font-semibold text-text-primary mb-3">9. Contact for data protection matters</h2>
            <p className="text-sm">
              Data protection enquiries:{" "}
              <a href={`mailto:${brand.email.privacy}`} className="text-brand-primary hover:underline">
                {brand.email.privacy}
              </a>
              {". "}
              Security incidents:{" "}
              <a href={`mailto:${brand.email.security}`} className="text-brand-primary hover:underline">
                {brand.email.security}
              </a>
            </p>
          </div>

        </div>
      </div>
    </section>
  );
}
