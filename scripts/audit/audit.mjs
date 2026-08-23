/**
 * Static audit — defect finder.
 *
 * Passes:
 *   1. Unresolved imports (module does not exist on disk)
 *   2. Missing named exports (symbol imported but never exported)
 *   3. Undefined JSX components (used but neither imported nor defined)
 *   4. Broken route references (href points at a non-existent page)
 *   5. Undeclared external dependencies (imported but not in package.json)
 */

import { existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";

import {
  ROOT, files, rel, packages, parseImports, parseExports,
  resolveSpec, exportsOf, read, sanitize,
} from "./resolve.mjs";

const defects = [];
const add = (severity, pass, file, line, message) =>
  defects.push({ severity, pass, file, line, message });

const lineOf = (src, needle) => {
  const i = src.indexOf(needle);
  return i < 0 ? 0 : src.slice(0, i).split("\n").length;
};

/* ------------------------------------------------------------------ */
/* Pass 1 + 2 + 5: imports                                             */
/* ------------------------------------------------------------------ */

const externalUsage = new Map(); // pkgName -> Set(importing workspace pkg)

function owningPackage(file) {
  for (const [name, info] of packages) {
    if (file.startsWith(info.dir + "/")) return name;
  }
  return null;
}

for (const file of files) {
  const raw = read(file);
  if (!raw) continue;
  const src = sanitize(raw);
  const imports = parseImports(src);

  for (const imp of imports) {
    const r = resolveSpec(file, imp.spec);

    if (r.kind === "builtin") continue;

    if (r.kind === "external") {
      const owner = owningPackage(file);
      if (!externalUsage.has(r.pkg)) externalUsage.set(r.pkg, new Set());
      externalUsage.get(r.pkg).add(owner ?? "(root)");
      continue;
    }

    // Pass 1 — does the module exist?
    if (!r.file) {
      add(
        "CRITICAL", "unresolved-import", rel(file),
        lineOf(src, imp.spec),
        `cannot resolve "${imp.spec}"`,
      );
      continue;
    }

    // Pass 2 — are the named symbols actually exported?
    if (imp.named.length && !imp.namespace) {
      const exported = exportsOf(r.file);
      // If the target has zero detected exports, parsing likely failed — skip
      // rather than emit a wall of false positives.
      if (exported.size === 0) continue;
      for (const n of imp.named) {
        if (!exported.has(n)) {
          add(
            "HIGH", "missing-export", rel(file),
            lineOf(src, n),
            `"${n}" not exported by ${rel(r.file)} (via "${imp.spec}")`,
          );
        }
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* Pass 3: JSX components used but never defined or imported           */
/* ------------------------------------------------------------------ */

const HTML_OK = new Set(["React", "Fragment"]);

for (const file of files) {
  if (!file.endsWith(".tsx") && !file.endsWith(".jsx")) continue;
  const raw = read(file);
  if (!raw) continue;
  const src = sanitize(raw);

  const imported = new Set();
  for (const imp of parseImports(src)) {
    for (const n of imp.named) imported.add(n);
    if (imp.defaultImport) imported.add(imp.defaultImport);
    const ns = src.match(new RegExp(`import\\s+\\*\\s+as\\s+(\\w+)\\s+from\\s+["']${imp.spec.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
    if (ns) imported.add(ns[1]);
  }

  // Locally declared identifiers
  const local = new Set();
  for (const m of src.matchAll(/(?:const|let|var|function|class)\s+([A-Z]\w*)/g)) local.add(m[1]);
  for (const m of src.matchAll(/(?:type|interface|enum)\s+([A-Z]\w*)/g)) local.add(m[1]);

  const used = new Set();
  // Negative lookbehind for a word char or dot: `forwardRef<HTMLDivElement` and
  // `React.FormEvent<HTMLFormElement>` are TYPE GENERICS, not JSX elements.
  // Real JSX is preceded by whitespace, `(`, `{`, `>` or start-of-line.
  for (const m of src.matchAll(/(?<![\w.$])<([A-Z][\w]*)(?:\.[A-Z]\w*)?[\s/>]/g)) used.add(m[1]);

  for (const u of used) {
    if (HTML_OK.has(u) || imported.has(u) || local.has(u)) continue;
    add(
      "CRITICAL", "undefined-component", rel(file),
      lineOf(src, `<${u}`),
      `<${u}> used but never imported or defined`,
    );
  }
}

/* ------------------------------------------------------------------ */
/* Pass 4: route references                                            */
/* ------------------------------------------------------------------ */

// Build the real route set from the App Router tree.
const appDir = join(ROOT, "apps/web/src/app");
const routes = new Set();
const dynamicRoutes = [];

function collectRoutes(dir, urlParts) {
  let entries;
  try { entries = readdirSync(dir); } catch { return; }
  for (const e of entries) {
    const full = join(dir, e);
    let st; try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) {
      if (e.startsWith("(") && e.endsWith(")")) collectRoutes(full, urlParts);      // route group
      else if (e.startsWith("@")) continue;                                          // parallel route
      else collectRoutes(full, [...urlParts, e]);
    } else if (e === "page.tsx" || e === "page.ts" || e === "page.jsx") {
      const path = "/" + urlParts.join("/");
      const norm = path === "/" ? "/" : path.replace(/\/+$/, "");
      if (norm.includes("[")) {
        dynamicRoutes.push(
          new RegExp("^" + norm.replace(/\[\.\.\.\w+\]/g, ".+").replace(/\[\w+\]/g, "[^/]+") + "$"),
        );
      }
      routes.add(norm);
    } else if (e === "route.ts" || e === "route.tsx") {
      routes.add("/" + urlParts.join("/"));
    }
  }
}
if (existsSync(appDir)) collectRoutes(appDir, []);

const EXTERNAL_OK = /^(https?:|mailto:|tel:|#|\{)/;

for (const file of files) {
  if (!file.startsWith(join(ROOT, "apps/web"))) continue;
  if (file.includes("/e2e/")) continue;
  const src = sanitize(read(file));
  if (!src) continue;

  const hrefs = new Set();
  for (const m of src.matchAll(/href=["']([^"']+)["']/g)) hrefs.add(m[1]);
  for (const m of src.matchAll(/href=\{["']([^"']+)["']\}/g)) hrefs.add(m[1]);

  for (const h of hrefs) {
    if (EXTERNAL_OK.test(h)) continue;
    if (!h.startsWith("/")) continue;
    const clean = h.split("?")[0].split("#")[0].replace(/\/+$/, "") || "/";
    if (routes.has(clean)) continue;
    if (dynamicRoutes.some((re) => re.test(clean))) continue;
    add(
      "HIGH", "broken-route", rel(file),
      lineOf(src, h),
      `href "${h}" does not resolve to a page`,
    );
  }
}

/* ------------------------------------------------------------------ */
/* Pass 5: undeclared external dependencies                            */
/* ------------------------------------------------------------------ */

for (const [extPkg, users] of externalUsage) {
  for (const owner of users) {
    if (owner === "(root)") continue;
    const info = packages.get(owner);
    if (!info) continue;
    const deps = {
      ...(info.pkg.dependencies ?? {}),
      ...(info.pkg.devDependencies ?? {}),
      ...(info.pkg.peerDependencies ?? {}),
    };
    if (extPkg in deps) continue;
    if (extPkg === "react" || extPkg === "react-dom") {
      add("MEDIUM", "undeclared-dep", owner, 0, `imports "${extPkg}" but does not declare it`);
      continue;
    }
    add("HIGH", "undeclared-dep", owner, 0, `imports "${extPkg}" but does not declare it in package.json`);
  }
}

/* ------------------------------------------------------------------ */
/* Report                                                              */
/* ------------------------------------------------------------------ */

const ORDER = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
defects.sort((a, b) => ORDER[a.severity] - ORDER[b.severity] || a.pass.localeCompare(b.pass) || a.file.localeCompare(b.file));

const byPass = {};
for (const d of defects) {
  byPass[d.pass] ??= { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, items: [] };
  byPass[d.pass][d.severity]++;
  byPass[d.pass].items.push(d);
}

console.log("=".repeat(78));
console.log("STATIC AUDIT —", relative(process.cwd(), ROOT) || ".");
console.log("=".repeat(78));
console.log(`files scanned      : ${files.length}`);
console.log(`workspace packages : ${packages.size}`);
console.log(`routes discovered  : ${routes.size} (${dynamicRoutes.length} dynamic)`);
console.log(`external packages  : ${externalUsage.size}`);
console.log("");

const counts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
for (const d of defects) counts[d.severity]++;
console.log("DEFECTS BY SEVERITY");
for (const s of ["CRITICAL", "HIGH", "MEDIUM", "LOW"]) console.log(`  ${s.padEnd(9)} ${counts[s]}`);
console.log(`  ${"TOTAL".padEnd(9)} ${defects.length}`);
console.log("");

console.log("DEFECTS BY PASS");
for (const [p, v] of Object.entries(byPass)) {
  console.log(`  ${p.padEnd(22)} C:${v.CRITICAL} H:${v.HIGH} M:${v.MEDIUM}`);
}

export { defects, byPass, routes, files, packages };

if (process.env.DETAIL) {
  console.log("\n" + "=".repeat(78));
  for (const [p, v] of Object.entries(byPass)) {
    console.log(`\n### ${p} (${v.items.length})`);
    for (const d of v.items) console.log(`  [${d.severity[0]}] ${d.file}:${d.line}  ${d.message}`);
  }
}

/* ------------------------------------------------------------------ */
/* Pass 6: package entry points actually exist                         */
/* ------------------------------------------------------------------ */
// Missed on the first run: nothing imported @submitpulse/database bare, so a
// dangling `main` never surfaced as an unresolved edge. Check manifests directly.
{
  const { existsSync: ex } = await import("node:fs");
  const { join: j } = await import("node:path");
  for (const [name, info] of packages) {
    const main = info.pkg.main;
    if (!main) continue;
    const p = j(info.dir, main.replace(/^\.\//, ""));
    if (!ex(p)) {
      add("CRITICAL", "missing-entrypoint", name, 0,
        `package.json main "${main}" does not exist (${rel(p)})`);
    }
  }
}
