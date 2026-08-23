"use client";

import React, { useRef, useEffect, useId, useCallback } from "react";
import { useForm, useFieldArray, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { cn } from "@submitpulse/ui";
import { useWizard, type FormField } from "./wizard-context";
import { createForm } from "./actions";

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const fieldSchema = z.object({
  id: z.string(),
  name: z
    .string()
    .min(1, "Field name is required")
    .regex(/^[a-z_][a-z0-9_]*$/, "Use lowercase letters, digits, and underscores only"),
  label: z.string().min(1, "Label is required"),
  type: z.string().min(1, "Type is required"),
  required: z.boolean(),
});

const detailsSchema = z.object({
  formName: z.string().min(2, "Form name must be at least 2 characters"),
  websiteUrl: z
    .string()
    .min(1, "Website URL is required")
    .url("Enter a valid URL including https://"),
  notificationEmail: z
    .string()
    .min(1, "Notification email is required")
    .email("Enter a valid email address"),
  allowedDomain: z
    .string()
    .min(1, "Allowed domain is required")
    .regex(
      /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}$/,
      "Enter a valid domain, e.g. https://example.com",
    ),
  fields: z.array(fieldSchema).min(1, "At least one field is required"),
});

type DetailsFormValues = z.infer<typeof detailsSchema>;

// ---------------------------------------------------------------------------
// Field row
// ---------------------------------------------------------------------------

const FIELD_TYPES = [
  "text", "email", "tel", "url", "textarea",
  "file", "select", "checkbox", "number",
] as const;

interface FieldRowProps {
  readonly index: number;
  readonly onRemove: () => void;
  readonly onMoveUp: () => void;
  readonly onMoveDown: () => void;
  readonly isFirst: boolean;
  readonly isLast: boolean;
  readonly register: ReturnType<typeof useForm<DetailsFormValues>>["register"];
  readonly errors: ReturnType<typeof useForm<DetailsFormValues>>["formState"]["errors"];
}

function FieldRow({
  index,
  onRemove,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
  register,
  errors,
}: FieldRowProps) {
  const nameId = useId();
  const labelId = useId();
  const typeId = useId();
  const reqId = useId();

  const fieldErrors = errors.fields?.[index];

  return (
    <div
      className="rounded-card border border-border bg-surface p-3 flex flex-col gap-3"
      role="group"
      aria-label={`Field ${index + 1}`}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* Name */}
        <div className="flex flex-col gap-1">
          <label htmlFor={nameId} className="text-xs font-medium text-text-secondary">
            Field name
          </label>
          <input
            id={nameId}
            {...register(`fields.${index}.name`)}
            className={cn(
              "rounded-input border px-3 py-1.5 text-sm bg-background text-text-primary",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring",
              fieldErrors?.name
                ? "border-danger aria-invalid:border-danger"
                : "border-border",
            )}
            aria-invalid={fieldErrors?.name ? true : undefined}
            aria-describedby={fieldErrors?.name ? `${nameId}-err` : undefined}
          />
          {fieldErrors?.name && (
            <span id={`${nameId}-err`} className="text-xs text-danger" role="alert">
              {fieldErrors.name.message}
            </span>
          )}
        </div>

        {/* Label */}
        <div className="flex flex-col gap-1">
          <label htmlFor={labelId} className="text-xs font-medium text-text-secondary">
            Display label
          </label>
          <input
            id={labelId}
            {...register(`fields.${index}.label`)}
            className={cn(
              "rounded-input border px-3 py-1.5 text-sm bg-background text-text-primary",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring",
              fieldErrors?.label
                ? "border-danger"
                : "border-border",
            )}
            aria-invalid={fieldErrors?.label ? true : undefined}
            aria-describedby={fieldErrors?.label ? `${labelId}-err` : undefined}
          />
          {fieldErrors?.label && (
            <span id={`${labelId}-err`} className="text-xs text-danger" role="alert">
              {fieldErrors.label.message}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        {/* Type */}
        <div className="flex flex-col gap-1">
          <label htmlFor={typeId} className="text-xs font-medium text-text-secondary">
            Type
          </label>
          <select
            id={typeId}
            {...register(`fields.${index}.type`)}
            className={cn(
              "rounded-input border border-border bg-background px-3 py-1.5 text-sm text-text-primary",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring",
            )}
          >
            {FIELD_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        {/* Required */}
        <div className="flex items-center gap-2 mt-4">
          <input
            id={reqId}
            type="checkbox"
            {...register(`fields.${index}.required`)}
            className="h-4 w-4 rounded accent-primary"
          />
          <label htmlFor={reqId} className="text-xs text-text-secondary">
            Required
          </label>
        </div>

        {/* Reorder + remove */}
        <div className="flex items-center gap-1 mt-4 ml-auto">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={isFirst}
            aria-label="Move field up"
            className={cn(
              "rounded p-1 text-text-muted transition-colors",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring",
              isFirst ? "opacity-30 cursor-not-allowed" : "hover:text-text-primary hover:bg-surface-elevated",
            )}
          >
            ↑
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={isLast}
            aria-label="Move field down"
            className={cn(
              "rounded p-1 text-text-muted transition-colors",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring",
              isLast ? "opacity-30 cursor-not-allowed" : "hover:text-text-primary hover:bg-surface-elevated",
            )}
          >
            ↓
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove field"
            className={cn(
              "rounded p-1 text-text-muted transition-colors",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring",
              "hover:text-danger hover:bg-danger/10",
            )}
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function StepDetails() {
  const { state, setDetails, goStep, submitStart, submitDone } = useWizard();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const formNameId = useId();
  const websiteUrlId = useId();
  const notificationEmailId = useId();
  const allowedDomainId = useId();

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  // Derive default fields from wizard state
  const defaultFields: DetailsFormValues["fields"] = state.fields.map(
    (f: FormField) => ({
      id: f.id,
      name: f.name,
      label: f.label,
      type: f.type,
      required: f.required,
    }),
  );

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<DetailsFormValues>({
    resolver: zodResolver(detailsSchema),
    defaultValues: {
      formName: state.formName,
      websiteUrl: state.websiteUrl,
      notificationEmail: state.notificationEmail,
      allowedDomain: state.allowedDomain,
      fields: defaultFields.length > 0 ? defaultFields : [
        { id: "default-0", name: "email", label: "Email address", type: "email", required: true },
      ],
    },
  });

  const { fields, append, remove, move } = useFieldArray({
    control,
    name: "fields",
  });

  const onSubmit: SubmitHandler<DetailsFormValues> = useCallback(
    async (values) => {
      setDetails({
        formName: values.formName,
        websiteUrl: values.websiteUrl,
        notificationEmail: values.notificationEmail,
        allowedDomain: values.allowedDomain,
        fields: values.fields,
      });

      submitStart();

      const templateId = state.templateId ?? "custom";

      const result = await createForm({
        publicFormId: state.publicFormId,
        formName: values.formName,
        websiteUrl: values.websiteUrl,
        notificationEmail: values.notificationEmail,
        allowedDomain: values.allowedDomain,
        fields: values.fields,
        templateId,
        builderId: state.builderId ?? "other",
      });

      submitDone(result.success === false ? result.message : null);
    },
    [setDetails, submitStart, submitDone, state],
  );

  const addField = useCallback(() => {
    append({
      id: Math.random().toString(36).slice(2, 10),
      name: "",
      label: "",
      type: "text",
      required: false,
    });
  }, [append]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
      <div>
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="text-2xl font-semibold text-text-primary focus:outline-none"
        >
          Form details
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          Validation runs in the browser, but the server is authoritative. Fix
          any server errors you see on the next screen.
        </p>
      </div>

      {/* Form name */}
      <div className="flex flex-col gap-1">
        <label htmlFor={formNameId} className="text-sm font-medium text-text-primary">
          Form name <span className="text-danger" aria-hidden>*</span>
        </label>
        <input
          id={formNameId}
          {...register("formName")}
          placeholder="Contact Us"
          className={cn(
            "rounded-input border px-3 py-2 text-sm bg-background text-text-primary",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring",
            errors.formName ? "border-danger" : "border-border",
          )}
          aria-invalid={errors.formName ? true : undefined}
          aria-describedby={errors.formName ? `${formNameId}-err` : undefined}
        />
        {errors.formName && (
          <span id={`${formNameId}-err`} className="text-xs text-danger" role="alert">
            {errors.formName.message}
          </span>
        )}
      </div>

      {/* Website URL */}
      <div className="flex flex-col gap-1">
        <label htmlFor={websiteUrlId} className="text-sm font-medium text-text-primary">
          Website URL <span className="text-danger" aria-hidden>*</span>
        </label>
        <input
          id={websiteUrlId}
          type="url"
          {...register("websiteUrl")}
          placeholder="https://example.com"
          className={cn(
            "rounded-input border px-3 py-2 text-sm bg-background text-text-primary",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring",
            errors.websiteUrl ? "border-danger" : "border-border",
          )}
          aria-invalid={errors.websiteUrl ? true : undefined}
          aria-describedby={errors.websiteUrl ? `${websiteUrlId}-err` : undefined}
        />
        {errors.websiteUrl && (
          <span id={`${websiteUrlId}-err`} className="text-xs text-danger" role="alert">
            {errors.websiteUrl.message}
          </span>
        )}
      </div>

      {/* Notification email */}
      <div className="flex flex-col gap-1">
        <label htmlFor={notificationEmailId} className="text-sm font-medium text-text-primary">
          Notification email <span className="text-danger" aria-hidden>*</span>
        </label>
        <input
          id={notificationEmailId}
          type="email"
          {...register("notificationEmail")}
          placeholder="you@example.com"
          className={cn(
            "rounded-input border px-3 py-2 text-sm bg-background text-text-primary",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring",
            errors.notificationEmail ? "border-danger" : "border-border",
          )}
          aria-invalid={errors.notificationEmail ? true : undefined}
          aria-describedby={
            errors.notificationEmail ? `${notificationEmailId}-err` : undefined
          }
        />
        {errors.notificationEmail && (
          <span id={`${notificationEmailId}-err`} className="text-xs text-danger" role="alert">
            {errors.notificationEmail.message}
          </span>
        )}
      </div>

      {/* Allowed domain */}
      <div className="flex flex-col gap-1">
        <label htmlFor={allowedDomainId} className="text-sm font-medium text-text-primary">
          Allowed domain <span className="text-danger" aria-hidden>*</span>
        </label>
        <p className="text-xs text-text-muted">
          Submissions from other origins will be rejected. Use https://example.com.
        </p>
        <input
          id={allowedDomainId}
          type="url"
          {...register("allowedDomain")}
          placeholder="https://example.com"
          className={cn(
            "rounded-input border px-3 py-2 text-sm bg-background text-text-primary",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring",
            errors.allowedDomain ? "border-danger" : "border-border",
          )}
          aria-invalid={errors.allowedDomain ? true : undefined}
          aria-describedby={
            errors.allowedDomain ? `${allowedDomainId}-err` : undefined
          }
        />
        {errors.allowedDomain && (
          <span id={`${allowedDomainId}-err`} className="text-xs text-danger" role="alert">
            {errors.allowedDomain.message}
          </span>
        )}
      </div>

      {/* Fields */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-text-primary">
            Expected fields{" "}
            <span className="text-xs font-normal text-text-muted">
              ({fields.length})
            </span>
          </h3>
          <button
            type="button"
            onClick={addField}
            className={cn(
              "text-xs font-medium text-primary hover:text-primary-hover",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring rounded",
              "px-2 py-1 transition-colors duration-fast",
            )}
          >
            + Add field
          </button>
        </div>

        {errors.fields && !Array.isArray(errors.fields) && (
          <span className="text-xs text-danger" role="alert">
            {errors.fields.message}
          </span>
        )}

        <div className="flex flex-col gap-2">
          {fields.map((field, index) => (
            <FieldRow
              key={field.id}
              index={index}
              isFirst={index === 0}
              isLast={index === fields.length - 1}
              onRemove={() => remove(index)}
              onMoveUp={() => move(index, index - 1)}
              onMoveDown={() => move(index, index + 1)}
              register={register}
              errors={errors}
            />
          ))}
        </div>
      </div>

      <div className="flex justify-between pt-2">
        <button
          type="button"
          onClick={() => goStep(2)}
          className={cn(
            "rounded-md px-4 py-2 text-sm font-medium text-text-secondary",
            "hover:text-text-primary transition-colors duration-fast",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring",
          )}
        >
          Back
        </button>
        <button
          type="submit"
          disabled={isSubmitting || state.submitting}
          className={cn(
            "rounded-md px-5 py-2 text-sm font-medium transition-all duration-fast",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring",
            "flex items-center gap-2",
            isSubmitting || state.submitting
              ? "cursor-wait bg-primary/70 text-white"
              : "bg-primary text-white hover:bg-primary-hover",
          )}
          aria-busy={isSubmitting || state.submitting}
        >
          {(isSubmitting || state.submitting) && (
            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden />
          )}
          Generate endpoint
        </button>
      </div>
    </form>
  );
}
