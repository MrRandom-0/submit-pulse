import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { brand } from "@submitpulse/config/brand";
import { CodeBlock, Badge, cn } from "@submitpulse/ui";
import { GUIDES, GUIDE_SLUGS, NAV_GROUPS, type GuideSlug } from "../content";

// ---------------------------------------------------------------------------
// Static params
// ---------------------------------------------------------------------------

export function generateStaticParams(): Array<{ slug: string }> {
  return GUIDE_SLUGS.map((slug) => ({ slug }));
}

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const guide = GUIDES[slug as GuideSlug];
  if (!guide) return {};
  return {
    title: `${guide.title} — ${brand.name} Docs`,
    description: guide.description,
  };
}

// ---------------------------------------------------------------------------
// Sidebar navigation
// ---------------------------------------------------------------------------

function DocsSidebar({ currentSlug }: { currentSlug: string }) {
  return (
    <nav
      aria-label="Documentation navigation"
      className="sticky top-8 w-56 flex-none hidden lg:block"
    >
      <div className="space-y-8">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-3">
              {group.label}
            </p>
            <ul className="space-y-1" role="list">
              {group.items.map((item) => (
                <li key={item.slug}>
                  <Link
                    href={`/docs/${item.slug}`}
                    className={cn(
                      "block text-sm px-2 py-1.5 rounded transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring",
                      currentSlug === item.slug
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-text-secondary hover:text-text-primary hover:bg-surface-elevated"
                    )}
                    aria-current={currentSlug === item.slug ? "page" : undefined}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <div>
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-3">
            Reference
          </p>
          <ul className="space-y-1" role="list">
            <li>
              <Link
                href="/docs/api"
                className="block text-sm px-2 py-1.5 rounded text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              >
                API Reference
              </Link>
            </li>
            <li>
              <Link
                href="/docs/webhook-reference"
                className="block text-sm px-2 py-1.5 rounded text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              >
                Webhook Reference
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function GuidePageRoute({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const guide = GUIDES[slug as GuideSlug];

  if (!guide) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
      <div className="flex gap-12">
        {/* Sidebar */}
        <DocsSidebar currentSlug={slug} />

        {/* Main content */}
        <main className="flex-1 min-w-0" id="main-content">
          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" className="mb-8">
            <ol className="flex items-center gap-2 text-sm text-text-muted" role="list">
              <li>
                <Link
                  href="/docs"
                  className="hover:text-text-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring rounded"
                >
                  Docs
                </Link>
              </li>
              <li aria-hidden="true" className="select-none">
                /
              </li>
              <li className="text-text-primary font-medium">{guide.title}</li>
            </ol>
          </nav>

          {/* Heading */}
          <div className="mb-10">
            <h1 className="text-3xl font-bold tracking-tight text-text-primary mb-3">
              {guide.title}
            </h1>
            <p className="text-base text-text-secondary leading-relaxed">
              {guide.description}
            </p>
          </div>

          {/* Sections */}
          <div className="space-y-12">
            {guide.sections.map((section, i) => (
              <section key={i} aria-labelledby={`section-${i}`}>
                <h2
                  id={`section-${i}`}
                  className="text-xl font-semibold text-text-primary mb-4"
                >
                  {section.heading}
                </h2>

                {section.body && (
                  <div className="prose prose-sm text-text-secondary max-w-none mb-6">
                    {/* Render body as plain text — guides use plain text with inline markdown-style formatting */}
                    {section.body.split("\n\n").map((para, pi) => {
                      // Code fence blocks inside body text
                      if (para.startsWith("```")) {
                        const lines = para.split("\n");
                        const lang = lines[0].slice(3);
                        const code = lines.slice(1, lines.length - 1).join("\n");
                        return (
                          <CodeBlock
                            key={pi}
                            code={code}
                            language={lang || undefined}
                            copyable
                            className="my-4"
                          />
                        );
                      }
                      return (
                        <p
                          key={pi}
                          className="text-sm text-text-secondary leading-relaxed mb-3 whitespace-pre-wrap"
                        >
                          {para}
                        </p>
                      );
                    })}
                  </div>
                )}

                {section.code && (
                  <CodeBlock
                    code={section.code}
                    language={section.language}
                    copyable
                    caption={section.codeCaption}
                    maxHeight={520}
                  />
                )}
              </section>
            ))}
          </div>

          {/* Footer nav */}
          <div className="mt-16 pt-8 border-t border-border">
            <div className="flex items-center justify-between">
              <div className="text-sm text-text-muted">
                Questions?{" "}
                <a
                  href={`mailto:${brand.email.support}`}
                  className="text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring rounded"
                >
                  Contact support
                </a>
              </div>
              <div className="flex items-center gap-4">
                <Link
                  href="/docs/api"
                  className="text-sm text-text-secondary hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring rounded"
                >
                  API Reference →
                </Link>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
