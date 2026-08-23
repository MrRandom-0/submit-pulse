"use client";

import * as React from "react";
import { cn } from "../cn";

const CopyIcon = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
    <rect x="4" y="4" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.25" />
    <path d="M2 9H1.5A1.5 1.5 0 0 1 0 7.5v-6A1.5 1.5 0 0 1 1.5 0h6A1.5 1.5 0 0 1 9 1.5V2" stroke="currentColor" strokeWidth="1.25" />
  </svg>
);

const CheckIcon = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
    <path d="M2 7L5.5 10.5L11 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export interface CodeBlockProps {
  code: string;
  language?: string;
  copyable?: boolean;
  maxHeight?: number;
  caption?: string;
  className?: string;
}

export function CodeBlock({
  code,
  language,
  copyable = true,
  maxHeight,
  caption,
  className,
}: CodeBlockProps): React.ReactElement {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = React.useCallback(async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      const timer = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(timer);
    } catch {
      // Clipboard API unavailable — fail silently
    }
  }, [code]);

  const headerLabel = caption ?? language;

  return (
    <div
      className={cn(
        "rounded-md border border-border overflow-hidden bg-code-background",
        className
      )}
    >
      {/* Header strip — always rendered when there's a label or copy button */}
      {(headerLabel || copyable) && (
        <div className="flex items-center justify-between gap-3 px-4 py-2 border-b border-border bg-surface">
          {headerLabel ? (
            <span className="text-2xs font-medium text-text-muted tracking-wide uppercase select-none">
              {headerLabel}
            </span>
          ) : (
            <span />
          )}
          {copyable && (
            <button
              type="button"
              onClick={handleCopy}
              aria-label={copied ? "Copied" : "Copy code"}
              className={cn(
                "inline-flex items-center gap-1.5 rounded px-2 py-1",
                "text-2xs font-medium transition-colors duration-fast ease-standard",
                "text-text-muted hover:text-text-primary hover:bg-background",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              )}
            >
              {copied ? (
                <>
                  <CheckIcon />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <CopyIcon />
                  <span>Copy</span>
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* Code body */}
      <div
        className="overflow-auto"
        style={maxHeight !== undefined ? { maxHeight } : undefined}
      >
        <pre className="px-4 py-4 text-sm font-mono text-text-primary leading-relaxed whitespace-pre">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
}
