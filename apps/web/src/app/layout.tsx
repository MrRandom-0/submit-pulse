import type { Metadata, Viewport } from "next";

import { brand } from "@submitpulse/config";

import "./globals.css";

/**
 * Root layout.
 *
 * Deliberately minimal: it owns the html/body shell, font wiring, theme
 * bootstrap and global providers only. Route-group layouts under
 * (marketing), (dashboard), (auth) and (onboarding) own their own chrome, so
 * the marketing nav never leaks into the app and vice versa.
 */

export const metadata: Metadata = {
  metadataBase: new URL(brand.domains.marketing),
  title: {
    default: `${brand.name} — ${brand.tagline}`,
    template: `%s · ${brand.name}`,
  },
  description: brand.description,
  openGraph: {
    type: "website",
    siteName: brand.name,
    title: `${brand.name} — ${brand.tagline}`,
    description: brand.description,
    url: brand.domains.marketing,
  },
  twitter: {
    card: "summary_large_image",
    title: `${brand.name} — ${brand.tagline}`,
    description: brand.description,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0d1117" },
  ],
  width: "device-width",
  initialScale: 1,
};

/**
 * Applied before first paint to prevent a flash of the wrong theme.
 *
 * Reads the persisted preference and falls back to the system setting. Kept as
 * a blocking inline script on purpose — deferring it would reintroduce the
 * flash. The CSS in theme.css handles the no-JS case via prefers-color-scheme,
 * so this script is a progressive enhancement, not a requirement.
 */
const themeBootstrap = `
(function () {
  try {
    var stored = localStorage.getItem('sp-theme');
    var root = document.documentElement;
    if (stored === 'light' || stored === 'dark') {
      root.classList.add(stored);
    }
  } catch (e) {
    /* Storage can throw in private mode; the CSS fallback covers us. */
  }
})();
`;

export default function RootLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          // eslint-disable-next-line react/no-danger -- see themeBootstrap note above
          dangerouslySetInnerHTML={{ __html: themeBootstrap }}
        />
      </head>
      <body className="min-h-screen bg-background text-text-primary antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-surface focus:px-4 focus:py-2 focus:outline-none focus:ring-2 focus:ring-focus-ring"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
