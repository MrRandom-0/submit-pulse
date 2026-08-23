"use client";

import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
} from "react";
import type { BuilderId } from "@submitpulse/config";
import type { TemplateId, TemplateField, FormTemplate } from "./templates";
import { TEMPLATES } from "./templates";
import { generatePublicFormId } from "../../lib/public-id";

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

export type WizardStep = 1 | 2 | 3 | 4;

export interface FormField {
  readonly id: string;
  name: string;
  label: string;
  type: string;
  required: boolean;
}

export interface WizardState {
  readonly step: WizardStep;
  /** Step 1 */
  readonly builderId: BuilderId | null;
  /** Step 2 */
  readonly templateId: TemplateId | null;
  /** Step 3 */
  readonly formName: string;
  readonly websiteUrl: string;
  readonly notificationEmail: string;
  readonly allowedDomain: string;
  readonly fields: readonly FormField[];
  /** Step 4 — generated once, stable for session */
  readonly publicFormId: string;
  /** Whether createForm() has been called yet */
  readonly submitted: boolean;
  /** Whether the backend stub is being called */
  readonly submitting: boolean;
  /** The not-wired warning message from actions.ts, if any */
  readonly backendWarning: string | null;
}

function makeId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function fieldsFromTemplate(templateId: TemplateId): FormField[] {
  const tpl = TEMPLATES[templateId] as FormTemplate | undefined;
  if (!tpl) return [];
  return tpl.fields.map((f: TemplateField): FormField => ({
    id: makeId(),
    name: f.name,
    label: f.label,
    type: f.type,
    required: f.required,
  }));
}

const INITIAL_STATE: WizardState = {
  step: 1,
  builderId: null,
  templateId: null,
  formName: "",
  websiteUrl: "",
  notificationEmail: "",
  allowedDomain: "",
  fields: [],
  publicFormId: generatePublicFormId(),
  submitted: false,
  submitting: false,
  backendWarning: null,
};

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

type WizardAction =
  | { type: "SET_BUILDER"; builderId: BuilderId }
  | { type: "SET_TEMPLATE"; templateId: TemplateId }
  | { type: "SET_DETAILS"; formName: string; websiteUrl: string; notificationEmail: string; allowedDomain: string; fields: readonly FormField[] }
  | { type: "GO_STEP"; step: WizardStep }
  | { type: "SUBMIT_START" }
  | { type: "SUBMIT_DONE"; backendWarning: string | null }
  | { type: "RESET" };

function reducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case "SET_BUILDER":
      return { ...state, builderId: action.builderId };
    case "SET_TEMPLATE": {
      const fields = fieldsFromTemplate(action.templateId);
      const tpl = TEMPLATES[action.templateId];
      return {
        ...state,
        templateId: action.templateId,
        fields,
        // Pre-fill form name from template label if not already set
        formName: state.formName === "" ? tpl.label : state.formName,
      };
    }
    case "SET_DETAILS":
      return {
        ...state,
        formName: action.formName,
        websiteUrl: action.websiteUrl,
        notificationEmail: action.notificationEmail,
        allowedDomain: action.allowedDomain,
        fields: action.fields,
      };
    case "GO_STEP":
      return { ...state, step: action.step };
    case "SUBMIT_START":
      return { ...state, submitting: true };
    case "SUBMIT_DONE":
      return {
        ...state,
        submitting: false,
        submitted: true,
        backendWarning: action.backendWarning,
        step: 4,
      };
    case "RESET":
      return { ...INITIAL_STATE, publicFormId: generatePublicFormId() };
    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface WizardContextValue {
  readonly state: WizardState;
  readonly setBuilder: (id: BuilderId) => void;
  readonly setTemplate: (id: TemplateId) => void;
  readonly setDetails: (details: {
    formName: string;
    websiteUrl: string;
    notificationEmail: string;
    allowedDomain: string;
    fields: readonly FormField[];
  }) => void;
  readonly goStep: (step: WizardStep) => void;
  readonly submitStart: () => void;
  readonly submitDone: (backendWarning: string | null) => void;
  readonly reset: () => void;
}

const WizardContext = createContext<WizardContextValue | null>(null);

export function WizardProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);

  const setBuilder = useCallback((builderId: BuilderId) => {
    dispatch({ type: "SET_BUILDER", builderId });
  }, []);

  const setTemplate = useCallback((templateId: TemplateId) => {
    dispatch({ type: "SET_TEMPLATE", templateId });
  }, []);

  const setDetails = useCallback((details: {
    formName: string;
    websiteUrl: string;
    notificationEmail: string;
    allowedDomain: string;
    fields: readonly FormField[];
  }) => {
    dispatch({ type: "SET_DETAILS", ...details });
  }, []);

  const goStep = useCallback((step: WizardStep) => {
    dispatch({ type: "GO_STEP", step });
  }, []);

  const submitStart = useCallback(() => {
    dispatch({ type: "SUBMIT_START" });
  }, []);

  const submitDone = useCallback((backendWarning: string | null) => {
    dispatch({ type: "SUBMIT_DONE", backendWarning });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: "RESET" });
  }, []);

  return (
    <WizardContext.Provider
      value={{ state, setBuilder, setTemplate, setDetails, goStep, submitStart, submitDone, reset }}
    >
      {children}
    </WizardContext.Provider>
  );
}

export function useWizard(): WizardContextValue {
  const ctx = useContext(WizardContext);
  if (!ctx) {
    throw new Error("useWizard must be used within WizardProvider");
  }
  return ctx;
}
