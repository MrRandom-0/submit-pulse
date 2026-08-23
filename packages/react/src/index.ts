/**
 * @submitpulse/react — React SDK for Submit Pulse.
 *
 * Published package name: @submitpulse/react
 * Peer dependencies: react >=18, @submitpulse/browser.
 *
 * NOTE: Using this package is entirely optional.
 * Plain fetch or @submitpulse/browser work fine without React wrappers.
 */

export { SubmitPulseProvider, useSubmitPulseClient } from "./context.js";
export type { SubmitPulseProviderProps } from "./context.js";

export { useSubmitPulseForm } from "./useSubmitPulseForm.js";
export type {
  UseSubmitPulseFormOptions,
  UseSubmitPulseFormReturn,
} from "./useSubmitPulseForm.js";

export { SubmitPulseForm, SubmitButton, FormStatus } from "./components.js";
export type {
  SubmitPulseFormProps,
  SubmitButtonProps,
  FormStatusProps,
} from "./components.js";
