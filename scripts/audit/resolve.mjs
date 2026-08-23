/**
 * Static audit — module graph resolution.
 *
 * Builds a map of every source file, every import, and every export, then
 * resolves each import edge against files that actually exist on disk.
 *
 * LIMITATIONS (stated honestly, since this substitutes for a real typechecker):
 *  - Regex-based parsing, not a TS AST. It will miss exotic syntax
 *    (exports inside conditionals, re-exports via computed names).
 *  - It cannot verify TYPES, only that a module and a named symbol exist.
 *  - `export *` chains are followed one level; deeper barrels may under-report.
 * A clean run here does NOT mean `tsc` will pass. It means the module graph is
 * internally consistent.
 */

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname, resolve as pathResolve, relative, extname } from "node:path";

export const ROOT = pathResolve(process.argv[2] ?? ".");

const SKIP_DIRS = new Set([
  "node_modules", ".git", ".next", "dist", "build", ".turbo", "coverage",
  "playwright-report", "test-results",
]);
const SRC_EXT = new Set([".ts", ".tsx", ".mts", ".js", ".mjs", ".jsx"]);

export function walk(dir, out = []) {
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const e of entries) {
    if (SKIP_DIRS.has(e)) continue;
    const full = join(dir, e);
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) walk(full, out);
    else if (SRC_EXT.has(extname(full))) out.push(full);
  }
  return out;
}

export const files = walk(ROOT);
export const rel = (f) => relative(ROOT, f);

/* -------------------------------------------------------------------------- */
/* Workspace package map                                                       */
/* -------------------------------------------------------------------------- */

export const packages = new Map(); // name -> { dir, main }
for (const base of ["packages", "apps"]) {
  const baseDir = join(ROOT, base);
  if (!existsSync(baseDir)) continue;
  for (const d of readdirSync(baseDir)) {
    const pj = join(baseDir, d, "package.json");
    if (!existsSync(pj)) continue;
    try {
      const j = JSON.parse(readFileSync(pj, "utf8"));
      if (j.name) packages.set(j.name, { dir: join(baseDir, d), pkg: j });
    } catch { /* malformed package.json is reported elsewhere */ }
  }
}

/* -------------------------------------------------------------------------- */
/* Parsing                                                                     */
/* -------------------------------------------------------------------------- */

const IMPORT_RE =
  /import\s+(?:type\s+)?(?:([\w*\s{},$]+?)\s+from\s+)?["']([^"']+)["']/g;
const EXPORT_FROM_RE = /export\s+(?:\*|\{[^}]*\})\s*(?:as\s+\w+\s*)?from\s+["']([^"']+)["']/g;

export function parseImports(src) {
  const out = [];
  for (const m of src.matchAll(IMPORT_RE)) {
    const clause = (m[1] ?? "").trim();
    const spec = m[2];
    const named = [];
    let defaultImport = null;
    let namespace = false;
    const braceMatch = clause.match(/\{([^}]*)\}/);
    if (braceMatch) {
      for (const part of braceMatch[1].split(",")) {
        const t = part.trim().replace(/^type\s+/, "");
        if (!t) continue;
        named.push(t.split(/\s+as\s+/)[0].trim());
      }
    }
    if (/\*\s+as\s+\w+/.test(clause)) namespace = true;
    const head = clause.replace(/\{[^}]*\}/, "").replace(/\*\s+as\s+\w+/, "").replace(/,/g, "").trim();
    if (head && !head.startsWith("type")) defaultImport = head;
    // A static ES import specifier is a string LITERAL — it can never contain
    // a template interpolation. Seeing `${` means the regex spanned blanked
    // template-literal whitespace and paired the wrong quotes. Discard.
    if (spec.includes("${")) continue;
    out.push({ spec, named, defaultImport, namespace, sideEffect: !clause });
  }
  for (const m of src.matchAll(EXPORT_FROM_RE)) {
    out.push({ spec: m[1], named: [], defaultImport: null, namespace: false, reexport: true });
  }
  return out;
}

const EXPORT_DECL_RE =
  /export\s+(?:declare\s+)?(?:abstract\s+)?(?:async\s+)?(?:const|let|var|function|class|interface|type|enum)\s+(\w+)/g;
const EXPORT_LIST_RE = /export\s*(?:type\s+)?\{([^}]*)\}(?!\s*from)/g;
const EXPORT_STAR_RE = /export\s+\*\s+from\s+["']([^"']+)["']/g;

export function parseExports(src) {
  const named = new Set();
  const stars = [];
  for (const m of src.matchAll(EXPORT_DECL_RE)) named.add(m[1]);
  for (const m of src.matchAll(EXPORT_LIST_RE)) {
    for (const part of m[1].split(",")) {
      const t = part.trim().replace(/^type\s+/, "");
      if (!t) continue;
      const seg = t.split(/\s+as\s+/);
      named.add((seg[1] ?? seg[0]).trim());
    }
  }
  for (const m of src.matchAll(/export\s*(?:type\s+)?\{([^}]*)\}\s*from/g)) {
    for (const part of m[1].split(",")) {
      const t = part.trim().replace(/^type\s+/, "");
      if (!t) continue;
      const seg = t.split(/\s+as\s+/);
      named.add((seg[1] ?? seg[0]).trim());
    }
  }
  for (const m of src.matchAll(EXPORT_STAR_RE)) stars.push(m[1]);
  const hasDefault = /export\s+default/.test(src);
  return { named, stars, hasDefault };
}

/* -------------------------------------------------------------------------- */
/* Resolution                                                                  */
/* -------------------------------------------------------------------------- */

const CANDIDATES = (base) => [
  base, `${base}.ts`, `${base}.tsx`, `${base}.mts`, `${base}.js`, `${base}.jsx`,
  join(base, "index.ts"), join(base, "index.tsx"), join(base, "index.js"),
];

function tryFile(base) {
  for (const c of CANDIDATES(base)) {
    if (existsSync(c) && statSync(c).isFile()) return c;
  }
  return null;
}

/**
 * Resolve an import specifier from a given file.
 * Returns { kind, file? , pkg?, subpath? }.
 *   kind: "relative" | "workspace" | "alias" | "external" | "builtin"
 */
export function resolveSpec(fromFile, spec) {
  if (spec.startsWith("node:")) return { kind: "builtin" };

  // Relative — strip the ESM .js extension TS projects use for .ts sources.
  if (spec.startsWith(".")) {
    const base = pathResolve(dirname(fromFile), spec);
    let file = tryFile(base);
    if (!file && /\.js$/.test(base)) file = tryFile(base.replace(/\.js$/, ""));
    if (!file && /\.jsx$/.test(base)) file = tryFile(base.replace(/\.jsx$/, ""));
    return { kind: "relative", file };
  }

  // Path alias @/... -> apps/web/src/...
  if (spec.startsWith("@/")) {
    const webSrc = join(ROOT, "apps/web/src");
    const base = join(webSrc, spec.slice(2));
    return { kind: "alias", file: tryFile(base) };
  }

  // Workspace package
  for (const [name, info] of packages) {
    if (spec === name || spec.startsWith(name + "/")) {
      const sub = spec === name ? "" : spec.slice(name.length + 1);
      if (!sub) {
        const main = info.pkg.main ?? "src/index.ts";
        return { kind: "workspace", pkg: name, file: tryFile(join(info.dir, main.replace(/^\.\//, ""))) ?? tryFile(join(info.dir, "src/index")) };
      }
      const cleaned = sub.replace(/\.js$/, "");
      const file =
        tryFile(join(info.dir, "src", cleaned)) ??
        tryFile(join(info.dir, cleaned));
      return { kind: "workspace", pkg: name, subpath: sub, file };
    }
  }

  return { kind: "external", pkg: spec.split("/").slice(0, spec.startsWith("@") ? 2 : 1).join("/") };
}

/** Collect exported names from a module, following `export *` one level. */
export function exportsOf(file, depth = 0) {
  if (!file || !existsSync(file)) return new Set();
  let src;
  try { src = readFileSync(file, "utf8"); } catch { return new Set(); }
  const { named, stars } = parseExports(src);
  if (depth < 2) {
    for (const s of stars) {
      const r = resolveSpec(file, s);
      if (r.file) for (const n of exportsOf(r.file, depth + 1)) named.add(n);
    }
  }
  return named;
}

export function read(f) {
  try { return readFileSync(f, "utf8"); } catch { return ""; }
}

/**
 * Strip comments and template-literal bodies before parsing.
 *
 * Necessary because this codebase GENERATES code as strings — snippets.ts
 * emits Vue/Svelte/React source inside template literals, and those contain
 * `import` statements that are data, not dependencies of this module. Parsing
 * them produced phantom imports of "vue", "svelte" and "./ContactForm".
 *
 * Backtick bodies are replaced with an equal number of newlines so reported
 * line numbers stay accurate.
 */
export function sanitize(src) {
  // Character scanner rather than regex. snippets.ts nests template literals
  // (`${cond ? `a` : `b`}`), which desynchronises any regex pairing of
  // backticks — that is how phantom "vue"/"svelte" imports leaked through.
  // Blanked regions keep their newlines so line numbers stay accurate.
  const out = src.split("");
  const n = src.length;
  let i = 0;
  const blank = (a, b) => {
    for (let k = a; k < b && k < n; k++) if (out[k] !== "\n") out[k] = " ";
  };
  // Stack of template-literal contexts; each entry tracks ${} nesting depth.
  const tmpl = [];
  while (i < n) {
    const c = src[i];
    const nx = src[i + 1];

    if (tmpl.length === 0) {
      if (c === "/" && nx === "/") { const e = src.indexOf("\n", i); const end = e < 0 ? n : e; blank(i, end); i = end; continue; }
      if (c === "/" && nx === "*") { const e = src.indexOf("*/", i + 2); const end = e < 0 ? n : e + 2; blank(i, end); i = end; continue; }
      if (c === '"' || c === "'") {
        let k = i + 1;
        while (k < n && src[k] !== c) { if (src[k] === "\\") k++; k++; }
        i = k + 1; continue; // plain strings are left intact
      }
      if (c === "`") { tmpl.push({ depth: 0, start: i + 1 }); i++; continue; }
      i++; continue;
    }

    // Inside a template literal
    const top = tmpl[tmpl.length - 1];
    if (c === "\\") { i += 2; continue; }
    if (top.depth === 0 && c === "$" && nx === "{") { blank(top.start, i); top.depth = 1; i += 2; continue; }
    if (top.depth > 0) {
      if (c === "{") { top.depth++; i++; continue; }
      if (c === "}") { top.depth--; if (top.depth === 0) top.start = i + 1; i++; continue; }
      if (c === "`") { tmpl.push({ depth: 0, start: i + 1 }); i++; continue; }
      i++; continue;
    }
    if (c === "`") { blank(top.start, i); tmpl.pop(); i++; continue; }
    i++;
  }
  return out.join("");
}
