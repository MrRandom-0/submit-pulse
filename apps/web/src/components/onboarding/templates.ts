/**
 * Form template definitions for onboarding step 2.
 *
 * Each template carries a real default field set that mirrors what a user would
 * expect to collect for that form type. Fields are used to pre-populate step 3
 * and to generate the AI integration prompt in step 4.
 */

import type { FormFieldSpec } from "@submitpulse/config";

export type FieldType =
  | "text"
  | "email"
  | "tel"
  | "url"
  | "textarea"
  | "file"
  | "select"
  | "checkbox"
  | "number";

export interface TemplateField {
  readonly name: string;
  readonly label: string;
  readonly type: FieldType;
  readonly required: boolean;
}

export type TemplateId =
  | "contact"
  | "lead"
  | "waitlist"
  | "newsletter"
  | "quote"
  | "job"
  | "feedback"
  | "support"
  | "custom";

export interface FormTemplate {
  readonly id: TemplateId;
  readonly label: string;
  readonly description: string;
  readonly fields: readonly TemplateField[];
  /** True if any field is a file upload */
  readonly hasFileUpload: boolean;
}

export const TEMPLATES: Readonly<Record<TemplateId, FormTemplate>> = {
  contact: {
    id: "contact",
    label: "Contact",
    description: "General contact form for inquiries",
    hasFileUpload: false,
    fields: [
      { name: "name", label: "Full name", type: "text", required: true },
      { name: "email", label: "Email address", type: "email", required: true },
      { name: "message", label: "Message", type: "textarea", required: true },
    ],
  },
  lead: {
    id: "lead",
    label: "Lead capture",
    description: "Collect qualified sales leads",
    hasFileUpload: false,
    fields: [
      { name: "name", label: "Full name", type: "text", required: true },
      { name: "email", label: "Work email", type: "email", required: true },
      { name: "company", label: "Company name", type: "text", required: true },
      { name: "role", label: "Job title", type: "text", required: false },
      { name: "phone", label: "Phone number", type: "tel", required: false },
      { name: "message", label: "How can we help?", type: "textarea", required: false },
    ],
  },
  waitlist: {
    id: "waitlist",
    label: "Waitlist",
    description: "Capture early-access signups",
    hasFileUpload: false,
    fields: [
      { name: "name", label: "Full name", type: "text", required: true },
      { name: "email", label: "Email address", type: "email", required: true },
      { name: "use_case", label: "What will you use it for?", type: "textarea", required: false },
    ],
  },
  newsletter: {
    id: "newsletter",
    label: "Newsletter",
    description: "Email newsletter subscription",
    hasFileUpload: false,
    fields: [
      { name: "email", label: "Email address", type: "email", required: true },
      { name: "first_name", label: "First name", type: "text", required: false },
    ],
  },
  quote: {
    id: "quote",
    label: "Quote request",
    description: "Request a price quote or proposal",
    hasFileUpload: false,
    fields: [
      { name: "name", label: "Full name", type: "text", required: true },
      { name: "email", label: "Email address", type: "email", required: true },
      { name: "company", label: "Company name", type: "text", required: false },
      { name: "phone", label: "Phone number", type: "tel", required: false },
      { name: "project_description", label: "Project description", type: "textarea", required: true },
      { name: "budget", label: "Budget range", type: "text", required: false },
      { name: "timeline", label: "Desired timeline", type: "text", required: false },
    ],
  },
  job: {
    id: "job",
    label: "Job application",
    description: "Accept job applications with file uploads",
    hasFileUpload: true,
    fields: [
      { name: "name", label: "Full name", type: "text", required: true },
      { name: "email", label: "Email address", type: "email", required: true },
      { name: "phone", label: "Phone number", type: "tel", required: false },
      { name: "linkedin_url", label: "LinkedIn profile URL", type: "url", required: false },
      { name: "resume", label: "Resume / CV", type: "file", required: true },
      { name: "cover_letter", label: "Cover letter", type: "textarea", required: false },
    ],
  },
  feedback: {
    id: "feedback",
    label: "Feedback",
    description: "Gather product or service feedback",
    hasFileUpload: false,
    fields: [
      { name: "name", label: "Name", type: "text", required: false },
      { name: "email", label: "Email address", type: "email", required: false },
      { name: "rating", label: "Rating (1–5)", type: "number", required: true },
      { name: "feedback", label: "Your feedback", type: "textarea", required: true },
    ],
  },
  support: {
    id: "support",
    label: "Support request",
    description: "Customer support and bug reports",
    hasFileUpload: true,
    fields: [
      { name: "name", label: "Full name", type: "text", required: true },
      { name: "email", label: "Email address", type: "email", required: true },
      { name: "subject", label: "Subject", type: "text", required: true },
      { name: "priority", label: "Priority", type: "select", required: false },
      { name: "description", label: "Describe the issue", type: "textarea", required: true },
      { name: "attachment", label: "Screenshot or file (optional)", type: "file", required: false },
    ],
  },
  custom: {
    id: "custom",
    label: "Custom",
    description: "Start from scratch with your own fields",
    hasFileUpload: false,
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "email", label: "Email address", type: "email", required: true },
    ],
  },
} as const;

export const ORDERED_TEMPLATES: readonly FormTemplate[] = [
  TEMPLATES.contact,
  TEMPLATES.lead,
  TEMPLATES.waitlist,
  TEMPLATES.newsletter,
  TEMPLATES.quote,
  TEMPLATES.job,
  TEMPLATES.feedback,
  TEMPLATES.support,
  TEMPLATES.custom,
];

/** Convert a TemplateField to the FormFieldSpec shape used by the config package. */
export function toFormFieldSpec(f: TemplateField): FormFieldSpec {
  return {
    name: f.name,
    type: f.type,
    required: f.required,
    label: f.label,
  };
}
