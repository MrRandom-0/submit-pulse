/**
 * React context carrying a SubmitPulseClient instance.
 *
 * NOTE: Using the React SDK is entirely optional. Plain fetch or the browser
 * SDK work fine without this package. This package only exists to remove
 * boilerplate for React applications.
 */

import {
  createContext,
  useContext,
  type ReactNode,
} from "react";
import type { SubmitPulseClient } from "@submitpulse/browser";

const SubmitPulseContext = createContext<SubmitPulseClient | null>(null);

export interface SubmitPulseProviderProps {
  client: SubmitPulseClient;
  children: ReactNode;
}

/**
 * Provide a SubmitPulseClient to all descendant components and hooks.
 *
 * @example
 * const client = createClient({ publicFormId: "fm_abc123" });
 * <SubmitPulseProvider client={client}>
 *   <ContactForm />
 * </SubmitPulseProvider>
 */
export function SubmitPulseProvider({
  client,
  children,
}: SubmitPulseProviderProps): JSX.Element {
  return (
    <SubmitPulseContext.Provider value={client}>
      {children}
    </SubmitPulseContext.Provider>
  );
}

/**
 * Returns the nearest SubmitPulseClient from context.
 * Throws if called outside a SubmitPulseProvider.
 */
export function useSubmitPulseClient(): SubmitPulseClient {
  const client = useContext(SubmitPulseContext);
  if (client === null) {
    throw new Error(
      "useSubmitPulseClient must be used inside a <SubmitPulseProvider>.",
    );
  }
  return client;
}
