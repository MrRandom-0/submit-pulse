/**
 * @submitpulse/database — public barrel.
 *
 * The package manifest points `main` here, but the file was missing: nothing
 * imported the package bare, so the dangling entry point never surfaced as a
 * broken import. It would have failed at the first `pnpm build`.
 *
 * The connection client is deliberately NOT exported yet. There is no
 * provisioned database, so exporting a half-wired `db` handle would invite
 * call sites that appear to work and fail at runtime. See
 * docs/40-known-limitations.md.
 */

export * from "./schema/index.js";
