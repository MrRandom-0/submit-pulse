/**
 * Stage 2 — Form lookup.
 *
 * Resolve the public form ID from the URL to a form row.
 * Validates:
 *   - Form exists and has not been deleted.
 *   - Form status is "active" (paused and archived both return 404 to avoid
 *     leaking status information to the public).
 *   - Per-form body size limit is re-applied now that we know the form config.
 */

import { brand } from "@submitpulse/config/brand";
import type { FormRepository, FormRow } from "../types.js";
import { Errors } from "../response.js";

const FORM_ID_PATTERN = new RegExp(
  `^${brand.identifiers.form}_[A-Za-z0-9]{22,}$`,
);

export async function lookupForm(
  publicFormId: string,
  repository: FormRepository,
  requestId: string,
  corsOrigin: string | null,
): Promise<{ form: FormRow } | Response> {
  // Validate ID shape before hitting the database.
  if (!FORM_ID_PATTERN.test(publicFormId)) {
    return Errors.formNotFound(requestId, corsOrigin);
  }

  let form: FormRow | null;
  try {
    form = await repository.findByPublicId(publicFormId);
  } catch {
    // Never leak DB errors to the caller.
    return Errors.serviceUnavailable(requestId, corsOrigin);
  }

  if (form === null) {
    return Errors.formNotFound(requestId, corsOrigin);
  }

  // Paused and archived forms both return 404 — do not leak operational status.
  if (form.status !== "active") {
    return Errors.formPaused(requestId, corsOrigin);
  }

  return { form };
}
