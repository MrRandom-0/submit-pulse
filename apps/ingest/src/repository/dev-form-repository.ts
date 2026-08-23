/**
 * Development / test form repository.
 *
 * Backed by in-memory maps — suitable for unit tests and local wrangler dev.
 * Not for production use: data is lost on Worker restart and is not shared
 * across instances.
 */

import type {
  FormRepository,
  FormRow,
  NewSubmission,
  ExistingSubmission,
} from "../types.js";

export class DevFormRepository implements FormRepository {
  private readonly forms = new Map<string, FormRow>();
  private readonly submissions = new Map<string, ExistingSubmission & { formId: string; idempotencyKey: string | null }>();

  /** Seed a form for test scenarios. */
  seedForm(form: FormRow): void {
    this.forms.set(form.publicId, form);
  }

  async findByPublicId(publicId: string): Promise<FormRow | null> {
    return this.forms.get(publicId) ?? null;
  }

  async createSubmission(submission: NewSubmission): Promise<string> {
    const id = crypto.randomUUID();
    this.submissions.set(id, {
      id,
      publicId: submission.publicId,
      requestId: submission.requestId,
      formId: submission.formId,
      idempotencyKey: submission.idempotencyKey,
    });
    return id;
  }

  async findByIdempotencyKey(
    formId: string,
    key: string,
  ): Promise<ExistingSubmission | null> {
    for (const sub of this.submissions.values()) {
      if (sub.formId === formId && sub.idempotencyKey === key) {
        return { id: sub.id, publicId: sub.publicId, requestId: sub.requestId };
      }
    }
    return null;
  }

  /** For tests: clear all data. */
  clear(): void {
    this.forms.clear();
    this.submissions.clear();
  }
}
