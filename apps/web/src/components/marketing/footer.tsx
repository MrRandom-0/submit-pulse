import Link from "next/link";
import { brand } from "@submitpulse/config/brand";

const FOOTER_COLUMNS = [
  {
    heading: "Product",
    links: [
      { label: "Features", href: "/features" },
      { label: "Pricing", href: "/pricing" },
      { label: "Security", href: "/security" },
      { label: "Changelog", href: `${brand.domains.docs}/changelog` },
      { label: "Status", href: brand.domains.status },
    ],
  },
  {
    heading: "Solutions",
    links: [
      { label: "AI Builders", href: "/ai-builders" },
      { label: "Developers", href: "/developers" },
      { label: "Agencies", href: "/agencies" },
      { label: "Spam Protection", href: "/spam-protection" },
      { label: "Form Monitoring", href: "/form-monitoring" },
    ],
  },
  {
    heading: "Integrations",
    links: [
      { label: "File Uploads", href: "/file-uploads" },
      { label: "Webhooks", href: "/webhooks" },
      { label: "Product Overview", href: "/product" },
    ],
  },
  {
    heading: "Resources",
    links: [
      { label: "Documentation", href: brand.domains.docs },
      { label: "Contact", href: "/contact" },
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
    ],
  },
] as const;

export function MarketingFooter() {
  return (
    <footer className="border-t border-border bg-surface" aria-label="Site footer">
      <div className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4 lg:gap-12">
          {FOOTER_COLUMNS.map((col) => (
            <div key={col.heading}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-4">
                {col.heading}
              </h3>
              <ul className="flex flex-col gap-3" role="list">
                {col.links.map(({ label, href }) => (
                  <li key={label}>
                    <Link
                      href={href}
                      className="text-sm text-text-secondary hover:text-text-primary transition-colors duration-fast ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring rounded"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-start gap-4 border-t border-border pt-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <svg
              aria-hidden="true"
              width="20"
              height="20"
              viewBox="0 0 28 28"
              fill="none"
            >
              <rect width="28" height="28" rx="6" className="fill-primary" />
              <path
                d="M8 14h4l2-5 2 10 2-5h2"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="text-sm font-semibold text-text-primary">
              {brand.name}
            </span>
          </div>
          <p className="text-xs text-text-muted">
            &copy; {new Date().getFullYear()} {brand.name}. All rights reserved.
          </p>
          <address className="not-italic">
            <a
              href={`mailto:${brand.email.support}`}
              className="text-xs text-text-muted hover:text-text-secondary transition-colors"
            >
              {brand.email.support}
            </a>
          </address>
        </div>
      </div>
    </footer>
  );
}
