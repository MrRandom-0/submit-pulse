import { useCallback, useRef, useState } from "react";
import {
  ValidationError,
  type SubmitOptions,
  type SubmitResult,
} from "@submitpulse/browser";
import { useSubmitPulseClient } from "./context.js";

export interface UseSubmitPulseFormOptions {
  /**
   * Per-submission options passed through to client.submit.
   * If you provide an idempotencyKey here it will be used as-is; for automatic
   * per-attempt key management see IdempotencyKeyManager in @submitpulse/browser.
   */
  submitOptions?: Omit<SubmitOptions, "signal">;
  /** Called after a successful submission. */
  onSuccess?: (result: SubmitResult) => void;
  /** Called after any failed submission (receives typed error). */
  onError?: (error: unknown) => void;
}

export interface UseSubmitPulseFormReturn {
  /** Call with your field data to fire the submission. */
  submit: (data: Record<string, unknown>) => Promise<void>;
  isSubmitting: boolean;
  isSuccess: boolean;
  /** The last error, or undefined if the last submit succeeded. */
  error: unknown;
  /**
   * Per-field validation errors from the server.
   * Map of field name → human-readable message.
   */
  fieldErrors: Record<string, string>;
  /** Reset state (isSuccess, error, fieldErrors) without reloading. */
  reset: () => void;
}

/**
 * Hook that manages the full lifecycle of a Submit Pulse form submission.
 *
 * Prevents concurrent submits: if a submit is already in-flight, subsequent
 * calls are silently dropped until the in-flight request settles.
 *
 * @example
 * const { submit, isSubmitting, isSuccess, error, fieldErrors, reset } =
 *   useSubmitPulseForm({ onSuccess: () => router.push("/thanks") });
 */
export function useSubmitPulseForm(
  opts: UseSubmitPulseFormOptions = {},
): UseSubmitPulseFormReturn {
  const client = useSubmitPulseClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<unknown>(undefined);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Guard ref: prevents a second submit while one is in-flight.
  // Using a ref instead of `isSubmitting` state avoids the race condition where
  // two rapid clicks both read isSubmitting=false before the first setState fires.
  const inFlight = useRef(false);

  const submit = useCallback(
    async (data: Record<string, unknown>): Promise<void> => {
      if (inFlight.current) return; // duplicate submit guard
      inFlight.current = true;
      setIsSubmitting(true);
      setError(undefined);
      setFieldErrors({});
      setIsSuccess(false);

      try {
        const result = await client.submit(data, opts.submitOptions);
        setIsSuccess(true);
        opts.onSuccess?.(result);
      } catch (err) {
        setError(err);
        if (err instanceof ValidationError) {
          setFieldErrors(err.fieldMessages);
        }
        opts.onError?.(err);
      } finally {
        inFlight.current = false;
        setIsSubmitting(false);
      }
    },
    // client is stable (same reference per provider); opts intentionally excluded
    // from deps to avoid re-creating submit on every render when callers inline
    // callbacks. Callers who need reactive callbacks should memoize them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [client],
  );

  const reset = useCallback((): void => {
    setIsSuccess(false);
    setError(undefined);
    setFieldErrors({});
  }, []);

  return { submit, isSubmitting, isSuccess, error, fieldErrors, reset };
}
