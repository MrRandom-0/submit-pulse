/**
 * D1-backed form repository.
 *
 * INCOMPLETE — the SQL queries are stubbed. The schema is fully defined in
 * packages/database/src/schema/. This file needs:
 *   1. Drizzle ORM or raw D1 queries wired to the Env.DB binding.
 *   2. JOIN across forms → form_domains → form_fields for findByPublicId.
 *   3. INSERT for createSubmission.
 *   4. SELECT for findByIdempotencyKey.
 *
 * Required env binding:
 *   DB — Cloudflare D1 database binding (see wrangler.toml [[d1_databases]])
 *
 * INCOMPLETE: this class throws on every method until implemented.
 */

import type {
  FormRepository,
  FormRow,
  NewSubmission,
  ExistingSubmission,
} from "../types.js";

export class D1FormRepository implements FormRepository {
  constructor(private readonly db: D1Database) {}

  // INCOMPLETE
  async findByPublicId(_publicId: string): Promise<FormRow | null> {
    // INCOMPLETE: wire Drizzle ORM or D1 prepared statements here.
    throw new Error(
      "D1FormRepository.findByPublicId is INCOMPLETE. " +
        "Wire Drizzle ORM queries to the D1 binding before deploying to production.",
    );
  }

  // INCOMPLETE
  async createSubmission(_submission: NewSubmission): Promise<string> {
    // INCOMPLETE
    throw new Error(
      "D1FormRepository.createSubmission is INCOMPLETE.",
    );
  }

  // INCOMPLETE
  async findByIdempotencyKey(
    _formId: string,
    _key: string,
  ): Promise<ExistingSubmission | null> {
    // INCOMPLETE
    throw new Error(
      "D1FormRepository.findByIdempotencyKey is INCOMPLETE.",
    );
  }
}
