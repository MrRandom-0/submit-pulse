/**
 * NOT WIRED — replace with server action calling packages/database.
 *
 * These functions are intentionally stubbed. They describe the shape of the
 * API calls that will happen once a backend exists. No data is persisted.
 */

import type { BuilderId } from "@submitpulse/config";
import type { TemplateId, TemplateField } from "./templates";

export interface CreateFormInput {
  readonly publicFormId: string;
  readonly formName: string;
  readonly websiteUrl: string;
  readonly notificationEmail: string;
  readonly allowedDomain: string;
  readonly fields: readonly TemplateField[];
  readonly templateId: TemplateId;
  readonly builderId: BuilderId;
}

export interface CreateFormResult {
  readonly success: false;
  readonly reason: "not_wired";
  readonly message: string;
}

/**
 * NOT WIRED — replace with server action calling packages/database.
 *
 * Will create the form record, associate the public ID, set up domain rules,
 * and return the persisted form data. For now it always returns a not_wired
 * signal so the UI can surface this honestly.
 */
export async function createForm(
  _input: CreateFormInput,
): Promise<CreateFormResult> {
  // Simulate a small network delay so the loading state is visible.
  await new Promise<void>((resolve) => setTimeout(resolve, 600));

  return {
    success: false,
    reason: "not_wired",
    message:
      "Form data is not yet persisted — the backend is not connected. " +
      "Your endpoint ID has been generated locally and will work once the " +
      "database integration is wired up.",
  };
}
