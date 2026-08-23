#!/usr/bin/env tsx
/**
 * BRAND LEAK VERIFIER
 * ===================
 *
 * The product must be renameable by editing BRAND_SEED in
 * packages/config/src/brand.ts and nothing else. This script fails CI when a
 * brand literal leaks into code that should derive it instead.
 *
 * Run: pnpm brand:verify
 *
 * Two severities:
 *   ERROR   — the literal appears in a runtime string, so a rename would leave
 *             stale text visible to users. Fails the build.
 *   WARNING — the literal appears only in a comment. Cosmetic after a rename;
 *             reported but non-fatal, because forcing indirection into prose
 *             comments makes them harder to read for no functional gain.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

import { BRAND_SEED } from "../packages/config/src/brand.js";

const ROOT = new URL("..", import.meta.url).pathname;

/** brand.ts is the one file allowed to contain the literals. */
const ALLOWLIST = new Set(["packages/config/src/brand.ts"]);

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  ".turbo",
  "coverage",
  "docs", // prose documentation may name the product freely
]);

const CODE_EXTENSIONS = new Set([".ts", ".tsx", ".mts", ".cts"]);

/** Literals that must not be hardcoded outside brand.ts. */
const FORBIDDEN: readonly string[] = [
  BRAND_SEED.name,
  BRAND_SEED.apexDomain,
  BRAND_SEED.npmScope,
];

interface Finding {
  readonly file: string;
  readonly line: number;
  readonly literal: string;
  readonly severity: "error" | "warning";
  readonly text: string;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (CODE_EXTENSIONS.has(extname(full))) out.push(full);
  }
  return out;
}

/**
 * Comment detection is intentionally simple line-based matching rather than a
 * full parse. A false "runtime" classification is the safe direction to err in:
 * it produces a loud failure rather than a silent leak.
 */
function isCommentLine(line: string): boolean {
  const t = line.trimStart();
  return t.startsWith("//") || t.startsWith("*") || t.startsWith("/*");
}

function main(): void {
  const findings: Finding[] = [];

  for (const file of walk(ROOT)) {
    const rel = relative(ROOT, file);
    if (ALLOWLIST.has(rel)) continue;

    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, i) => {
      for (const literal of FORBIDDEN) {
        if (!line.includes(literal)) continue;
        findings.push({
          file: rel,
          line: i + 1,
          literal,
          severity: isCommentLine(line) ? "warning" : "error",
          text: line.trim().slice(0, 120),
        });
      }
    });
  }

  const errors = findings.filter((f) => f.severity === "error");
  const warnings = findings.filter((f) => f.severity === "warning");

  for (const f of warnings) {
    console.warn(`  warn  ${f.file}:${f.line}  "${f.literal}" in comment`);
  }
  for (const f of errors) {
    console.error(`  ERROR ${f.file}:${f.line}  ${f.text}`);
  }

  console.log(
    `\nbrand:verify — ${errors.length} error(s), ${warnings.length} warning(s)`,
  );

  if (errors.length > 0) {
    console.error(
      "\nA rename would leave stale text visible to users.\n" +
        "Import { brand } from '@submitpulse/config' and use the derived value.",
    );
    process.exit(1);
  }
}

main();
