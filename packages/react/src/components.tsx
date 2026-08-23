/**
 * Headless-ish form components for Submit Pulse.
 * No styling is imposed. All components are accessible by default.
 *
 * NOTE: These components are optional. The hook useSubmitPulseForm is the
 * minimal integration surface; these wrappers only remove additional boilerplate.
 */

import {
  type FormEvent,
  type ReactNode,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
} from "react";
import type { UseSubmitPulseFormReturn } from "./useSubmitPulseForm.js";

// ---------------------------------------------------------------------------
// SubmitPulseForm
// ---------------------------------------------------------------------------

export interface SubmitPulseFormProps {
  /**
   * Render prop that receives the form state. Use this for full control,
   * or just place children directly if you consume state from the hook.
   */
  children:
    | ReactNode
    | ((state: UseSubmitPulseFormReturn) => ReactNode);

  /**
   * The form state from useSubmitPulseForm. Required so the component can
   * wire onSubmit and pass state to the render prop.
   */
  formState: UseSubmitPulseFormReturn;

  /** Any extra props forwarded to the underlying <form> element. */
  className?: string;
  id?: string;
}

/**
 * Headless form wrapper. Extracts FormData on submit and calls formState.submit.
 * Prevents default browser form navigation.
 *
 * @example
 * const formState = useSubmitPulseForm({ onSuccess: () => alert("Sent!") });
 *
 * <SubmitPulseForm formState={formState}>
 *   <input name="email" type="email" required />
 *   <SubmitButton formState={formState}>Send</SubmitButton>
 * </SubmitPulseForm>
 */
export function SubmitPulseForm({
  children,
  formState,
  className,
  id,
}: SubmitPulseFormProps): JSX.Element {
  function handleSubmit(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    const rawData = Object.fromEntries(
      new FormData(e.currentTarget).entries(),
    );
    // FormData values are string | File; the SDK handles both.
    void formState.submit(rawData as Record<string, unknown>);
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      aria-busy={formState.isSubmitting}
      className={className}
      id={id}
    >
      {typeof children === "function" ? children(formState) : children}
    </form>
  );
}

// ---------------------------------------------------------------------------
// SubmitButton
// ---------------------------------------------------------------------------

export interface SubmitButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type" | "disabled"> {
  formState: UseSubmitPulseFormReturn;
  children?: ReactNode;
}

/**
 * Submit button that is automatically disabled and shows a busy state while
 * a submission is in-flight. Forwards all other button props.
 *
 * @example
 * <SubmitButton formState={formState}>
 *   {formState.isSubmitting ? "Sending…" : "Send"}
 * </SubmitButton>
 */
export function SubmitButton({
  formState,
  children,
  ...rest
}: SubmitButtonProps): JSX.Element {
  return (
    <button
      type="submit"
      disabled={formState.isSubmitting}
      aria-disabled={formState.isSubmitting}
      {...rest}
    >
      {children ?? (formState.isSubmitting ? "Submitting…" : "Submit")}
    </button>
  );
}

// ---------------------------------------------------------------------------
// FormStatus
// ---------------------------------------------------------------------------

export interface FormStatusProps extends HTMLAttributes<HTMLDivElement> {
  formState: UseSubmitPulseFormReturn;
  successMessage?: string;
  errorMessage?: string | ((error: unknown) => string);
}

/**
 * Accessible status region. Announces success or error to screen readers via
 * aria-live="polite". Renders nothing when idle.
 *
 * @example
 * <FormStatus
 *   formState={formState}
 *   successMessage="Your message was sent."
 *   errorMessage="Something went wrong. Please try again."
 * />
 */
export function FormStatus({
  formState,
  successMessage = "Your submission was received.",
  errorMessage = "Submission failed. Please try again.",
  ...rest
}: FormStatusProps): JSX.Element {
  const isIdle = !formState.isSuccess && formState.error === undefined;

  const message = formState.isSuccess
    ? successMessage
    : typeof errorMessage === "function"
      ? errorMessage(formState.error)
      : errorMessage;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      {...rest}
    >
      {!isIdle && message}
    </div>
  );
}
