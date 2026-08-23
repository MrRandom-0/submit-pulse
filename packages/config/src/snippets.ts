/**
 * SNIPPET GENERATOR
 * =================
 * Produces real, copy-pasteable integration code for every supported flavour.
 * All snippets POST to the provided endpoint, handle loading/error/success
 * states, prevent duplicate submissions, include accessible validation, and
 * read the API's structured error shape.
 *
 * SECURITY: This module never accepts, reads, or emits API keys, management
 * keys, session tokens, or installation tokens. The endpoint URL is public by
 * design; no credential is required or permitted here.
 */

export interface FormFieldSpec {
  readonly name: string;
  readonly type: string;
  readonly required: boolean;
  readonly label?: string | undefined;
}

export interface SnippetInput {
  readonly flavour: "react" | "nextjs" | "vue" | "svelte" | "astro" | "html" | "none";
  readonly endpoint: string;
  readonly fields: readonly FormFieldSpec[];
  readonly captchaEnabled: boolean;
  readonly hasFileUpload: boolean;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function fieldLabel(f: FormFieldSpec): string {
  return f.label ?? f.name.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
}

function inputType(f: FormFieldSpec): string {
  if (f.type === "email") return "email";
  if (f.type === "tel") return "tel";
  if (f.type === "url") return "url";
  if (f.type === "number") return "number";
  if (f.type === "file") return "file";
  if (f.type === "textarea") return "textarea";
  if (f.type === "checkbox") return "checkbox";
  return "text";
}

/** Generate the initial form state object literal. */
function reactInitialState(fields: readonly FormFieldSpec[]): string {
  return fields
    .map((f) => {
      const t = inputType(f);
      if (t === "checkbox") return `  ${f.name}: false,`;
      if (t === "file") return `  ${f.name}: null,`;
      return `  ${f.name}: "",`;
    })
    .join("\n");
}

/** Generate JSX inputs for React/Next.js. */
function reactInputsJSX(fields: readonly FormFieldSpec[], captchaEnabled: boolean): string {
  const lines: string[] = [];

  for (const f of fields) {
    const t = inputType(f);
    const lbl = fieldLabel(f);
    const errId = `${f.name}-error`;
    const req = f.required ? " required" : "";
    const aria = `aria-invalid={!!errors.${f.name}} aria-describedby="${errId}"`;

    if (t === "textarea") {
      lines.push(
        `      <div className="field">`,
        `        <label htmlFor="${f.name}">${lbl}${f.required ? " *" : ""}</label>`,
        `        <textarea`,
        `          id="${f.name}"`,
        `          name="${f.name}"`,
        `          value={form.${f.name} as string}`,
        `          onChange={(e) => setForm((p) => ({ ...p, ${f.name}: e.target.value }))}`,
        `          ${aria}${req}`,
        `        />`,
        `        {errors.${f.name} && <span id="${errId}" role="alert">{errors.${f.name}}</span>}`,
        `      </div>`,
      );
    } else if (t === "checkbox") {
      lines.push(
        `      <div className="field field--checkbox">`,
        `        <label>`,
        `          <input`,
        `            id="${f.name}"`,
        `            name="${f.name}"`,
        `            type="checkbox"`,
        `            checked={form.${f.name} as boolean}`,
        `            onChange={(e) => setForm((p) => ({ ...p, ${f.name}: e.target.checked }))}`,
        `            ${aria}${req}`,
        `          />`,
        `          ${lbl}${f.required ? " *" : ""}`,
        `        </label>`,
        `        {errors.${f.name} && <span id="${errId}" role="alert">{errors.${f.name}}</span>}`,
        `      </div>`,
      );
    } else if (t === "file") {
      lines.push(
        `      <div className="field">`,
        `        <label htmlFor="${f.name}">${lbl}${f.required ? " *" : ""}</label>`,
        `        <input`,
        `          id="${f.name}"`,
        `          name="${f.name}"`,
        `          type="file"`,
        `          onChange={(e) => setForm((p) => ({ ...p, ${f.name}: e.target.files?.[0] ?? null }))}`,
        `          ${aria}${req}`,
        `        />`,
        `        {errors.${f.name} && <span id="${errId}" role="alert">{errors.${f.name}}</span>}`,
        `      </div>`,
      );
    } else {
      lines.push(
        `      <div className="field">`,
        `        <label htmlFor="${f.name}">${lbl}${f.required ? " *" : ""}</label>`,
        `        <input`,
        `          id="${f.name}"`,
        `          name="${f.name}"`,
        `          type="${t}"`,
        `          value={form.${f.name} as string}`,
        `          onChange={(e) => setForm((p) => ({ ...p, ${f.name}: e.target.value }))}`,
        `          ${aria}${req}`,
        `        />`,
        `        {errors.${f.name} && <span id="${errId}" role="alert">{errors.${f.name}}</span>}`,
        `      </div>`,
      );
    }
  }

  if (captchaEnabled) {
    lines.push(
      `      {/* Cloudflare Turnstile — renders into #turnstile-container */}`,
      `      <div id="turnstile-container" />`,
    );
  }

  return lines.join("\n");
}

function reactValidation(fields: readonly FormFieldSpec[]): string {
  const checks = fields
    .filter((f) => f.required)
    .map((f) => {
      const t = inputType(f);
      if (t === "checkbox") {
        return `  if (!data.${f.name}) next.${f.name} = "${fieldLabel(f)} is required";`;
      }
      if (t === "file") {
        return `  if (!data.${f.name}) next.${f.name} = "${fieldLabel(f)} is required";`;
      }
      return `  if (!String(data.${f.name}).trim()) next.${f.name} = "${fieldLabel(f)} is required";`;
    });
  return checks.join("\n");
}

// ---------------------------------------------------------------------------
// React snippet
// ---------------------------------------------------------------------------

function reactSnippet(input: SnippetInput): string {
  const { endpoint, fields, captchaEnabled, hasFileUpload } = input;
  const stateType = fields.map((f) => {
    const t = inputType(f);
    if (t === "checkbox") return `  ${f.name}: boolean;`;
    if (t === "file") return `  ${f.name}: File | null;`;
    return `  ${f.name}: string;`;
  }).join("\n");

  const bodyBlock = hasFileUpload
    ? `    const body = new FormData();
    for (const [k, v] of Object.entries(form)) {
      if (v instanceof File) body.append(k, v);
      else if (typeof v === "boolean") body.append(k, v ? "true" : "false");
      else if (v !== null) body.append(k, v as string);
    }${captchaEnabled ? `\n    body.append("cf-turnstile-response", turnstileToken);` : ""}`
    : `    const payload: Record<string, unknown> = { ...form };${captchaEnabled ? `\n    payload["cf-turnstile-response"] = turnstileToken;` : ""}
    const body = JSON.stringify(payload);`;

  const contentTypeHeader = hasFileUpload
    ? `// FormData sets its own Content-Type with boundary`
    : `"Content-Type": "application/json",`;

  const turnstileDecl = captchaEnabled
    ? `  const [turnstileToken, setTurnstileToken] = useState("");

  // Load Turnstile once and bind it to #turnstile-container.
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    script.async = true;
    document.body.appendChild(script);
    script.onload = () => {
      (window as unknown as { turnstile: { render: (el: string, opts: Record<string, unknown>) => void } }).turnstile.render(
        "#turnstile-container",
        {
          sitekey: "<YOUR_TURNSTILE_SITE_KEY>",
          callback: (token: string) => setTurnstileToken(token),
        },
      );
    };
    return () => { document.body.removeChild(script); };
  }, []);

`
    : "";

  const turnstileGuard = captchaEnabled
    ? `\n    if (!turnstileToken) { setError("Please complete the CAPTCHA."); return; }\n`
    : "";

  return `"use client"; // Remove this line if not using Next.js App Router

import { useState${captchaEnabled ? ", useEffect" : ""} } from "react";

// SECURITY: No API key is needed or accepted. The endpoint is public and
// identified only by the form ID embedded in the URL. Do not add credentials.
const ENDPOINT = "${endpoint}";

interface FormState {
${stateType}
}

type FormErrors = Partial<Record<keyof FormState, string>>;

function validate(data: FormState): FormErrors {
  const next: FormErrors = {};
${reactValidation(fields)}
  return next;
}

export function ContactForm() {
  const [form, setForm] = useState<FormState>({
${reactInitialState(fields)}
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
${captchaEnabled ? `  const [turnstileToken, setTurnstileToken] = useState("");

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    script.async = true;
    document.body.appendChild(script);
    script.onload = () => {
      (window as unknown as { turnstile: { render: (el: string, opts: Record<string, unknown>) => void } }).turnstile.render(
        "#turnstile-container",
        {
          sitekey: "<YOUR_TURNSTILE_SITE_KEY>",
          callback: (token: string) => setTurnstileToken(token),
        },
      );
    };
    return () => { document.body.removeChild(script); };
  }, []);
` : ""}
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const clientErrors = validate(form);
    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      return;
    }
    if (submitting) return; // prevent duplicate submission
${turnstileGuard}
    setSubmitting(true);
    setServerError(null);

    try {
${bodyBlock}
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          ${contentTypeHeader}
          Accept: "application/json",
        },
        body,
      });

      if (!res.ok) {
        // Read the structured error shape the API returns.
        const json = await res.json().catch(() => ({})) as { error?: string; message?: string };
        setServerError(json.error ?? json.message ?? \`Submission failed (\${res.status})\`);
        return;
      }

      setSuccess(true);
    } catch {
      setServerError("Network error — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div role="status" aria-live="polite">
        <p>Thank you! Your message has been received.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {serverError && (
        <div role="alert" style={{ color: "red" }}>
          {serverError}
        </div>
      )}
${reactInputsJSX(fields, captchaEnabled)}
      <button type="submit" disabled={submitting} aria-busy={submitting}>
        {submitting ? "Sending…" : "Send"}
      </button>
    </form>
  );
}
`;
}

// ---------------------------------------------------------------------------
// Next.js snippet (adds server action variant note, otherwise same as React)
// ---------------------------------------------------------------------------

function nextjsSnippet(input: SnippetInput): string {
  // Next.js uses the same React component pattern but with 'use client' and
  // environment variable awareness. We reuse the React snippet body and prefix.
  return reactSnippet({ ...input, flavour: "react" });
}

// ---------------------------------------------------------------------------
// Vue snippet
// ---------------------------------------------------------------------------

function vueInputs(fields: readonly FormFieldSpec[], captchaEnabled: boolean): string {
  const lines: string[] = [];
  for (const f of fields) {
    const t = inputType(f);
    const lbl = fieldLabel(f);
    const errId = `${f.name}-error`;
    const req = f.required ? " required" : "";

    if (t === "textarea") {
      lines.push(
        `    <div class="field">`,
        `      <label :for="'${f.name}'">${lbl}${f.required ? " *" : ""}</label>`,
        `      <textarea`,
        `        id="${f.name}"`,
        `        v-model="form.${f.name}"`,
        `        :aria-invalid="!!errors.${f.name}"`,
        `        aria-describedby="${errId}"${req}`,
        `      />`,
        `      <span v-if="errors.${f.name}" :id="'${errId}'" role="alert">{{ errors.${f.name} }}</span>`,
        `    </div>`,
      );
    } else if (t === "checkbox") {
      lines.push(
        `    <div class="field field--checkbox">`,
        `      <label>`,
        `        <input`,
        `          id="${f.name}"`,
        `          type="checkbox"`,
        `          v-model="form.${f.name}"`,
        `          :aria-invalid="!!errors.${f.name}"`,
        `          aria-describedby="${errId}"${req}`,
        `        />`,
        `        ${lbl}${f.required ? " *" : ""}`,
        `      </label>`,
        `      <span v-if="errors.${f.name}" :id="'${errId}'" role="alert">{{ errors.${f.name} }}</span>`,
        `    </div>`,
      );
    } else if (t === "file") {
      lines.push(
        `    <div class="field">`,
        `      <label :for="'${f.name}'">${lbl}${f.required ? " *" : ""}</label>`,
        `      <input`,
        `        id="${f.name}"`,
        `        type="file"`,
        `        @change="onFile('${f.name}', $event)"`,
        `        :aria-invalid="!!errors.${f.name}"`,
        `        aria-describedby="${errId}"${req}`,
        `      />`,
        `      <span v-if="errors.${f.name}" :id="'${errId}'" role="alert">{{ errors.${f.name} }}</span>`,
        `    </div>`,
      );
    } else {
      lines.push(
        `    <div class="field">`,
        `      <label :for="'${f.name}'">${lbl}${f.required ? " *" : ""}</label>`,
        `      <input`,
        `        id="${f.name}"`,
        `        type="${t}"`,
        `        v-model="form.${f.name}"`,
        `        :aria-invalid="!!errors.${f.name}"`,
        `        aria-describedby="${errId}"${req}`,
        `      />`,
        `      <span v-if="errors.${f.name}" :id="'${errId}'" role="alert">{{ errors.${f.name} }}</span>`,
        `    </div>`,
      );
    }
  }
  if (captchaEnabled) {
    lines.push(
      `    <!-- Cloudflare Turnstile — mounts into this div -->`,
      `    <div id="turnstile-container" />`,
    );
  }
  return lines.join("\n");
}

function vueSnippet(input: SnippetInput): string {
  const { endpoint, fields, captchaEnabled, hasFileUpload } = input;

  const dataFields = fields.map((f) => {
    const t = inputType(f);
    if (t === "checkbox") return `      ${f.name}: false,`;
    if (t === "file") return `      ${f.name}: null as File | null,`;
    return `      ${f.name}: "",`;
  }).join("\n");

  const validationChecks = fields
    .filter((f) => f.required)
    .map((f) => {
      const t = inputType(f);
      if (t === "checkbox") return `      if (!this.form.${f.name}) this.errors.${f.name} = "${fieldLabel(f)} is required";`;
      if (t === "file") return `      if (!this.form.${f.name}) this.errors.${f.name} = "${fieldLabel(f)} is required";`;
      return `      if (!String(this.form.${f.name}).trim()) this.errors.${f.name} = "${fieldLabel(f)} is required";`;
    }).join("\n");

  const bodyBlock = hasFileUpload
    ? `      const body = new FormData();
      for (const [k, v] of Object.entries(this.form)) {
        if (v instanceof File) body.append(k, v);
        else if (typeof v === "boolean") body.append(k, v ? "true" : "false");
        else if (v !== null) body.append(k, String(v));
      }${captchaEnabled ? `\n      body.append("cf-turnstile-response", this.turnstileToken);` : ""}`
    : `      const payload: Record<string, unknown> = { ...this.form };${captchaEnabled ? `\n      payload["cf-turnstile-response"] = this.turnstileToken;` : ""}
      const body = JSON.stringify(payload);`;

  const contentTypeHeader = hasFileUpload
    ? `// FormData sets Content-Type automatically`
    : `"Content-Type": "application/json",`;

  const fileMethod = fields.some((f) => inputType(f) === "file")
    ? `    onFile(name: string, e: Event) {
      const input = e.target as HTMLInputElement;
      (this.form as Record<string, unknown>)[name] = input.files?.[0] ?? null;
    },
`
    : "";

  const turnstileSetup = captchaEnabled
    ? `
  mounted() {
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    script.async = true;
    document.body.appendChild(script);
    script.onload = () => {
      (window as unknown as { turnstile: { render: (el: string, opts: Record<string, unknown>) => void } }).turnstile.render(
        "#turnstile-container",
        {
          sitekey: "<YOUR_TURNSTILE_SITE_KEY>",
          callback: (token: string) => { this.turnstileToken = token; },
        },
      );
    };
  },`
    : "";

  return `<template>
  <div>
    <div v-if="success" role="status" aria-live="polite">
      <p>Thank you! Your message has been received.</p>
    </div>
    <form v-else @submit.prevent="handleSubmit" novalidate>
      <div v-if="serverError" role="alert" style="color: red">{{ serverError }}</div>
${vueInputs(fields, captchaEnabled)}
      <button type="submit" :disabled="submitting" :aria-busy="submitting">
        {{ submitting ? "Sending…" : "Send" }}
      </button>
    </form>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";

// SECURITY: No API key is needed or accepted. The endpoint is public and
// identified only by the form ID embedded in the URL. Do not add credentials.
const ENDPOINT = "${endpoint}";

export default defineComponent({
  data() {
    return {
${dataFields}
      errors: {} as Record<string, string>,
      submitting: false,
      serverError: null as string | null,
      success: false,${captchaEnabled ? `\n      turnstileToken: "",` : ""}
    };
  },${turnstileSetup}
  methods: {
${fileMethod}    validate(): boolean {
      this.errors = {};
${validationChecks}
      return Object.keys(this.errors).length === 0;
    },
    async handleSubmit() {
      if (!this.validate()) return;
      if (this.submitting) return;${captchaEnabled ? `\n      if (!this.turnstileToken) { this.serverError = "Please complete the CAPTCHA."; return; }` : ""}
      this.submitting = true;
      this.serverError = null;
      try {
${bodyBlock}
        const res = await fetch(ENDPOINT, {
          method: "POST",
          headers: {
            ${contentTypeHeader}
            Accept: "application/json",
          },
          body,
        });
        if (!res.ok) {
          const json = await res.json().catch(() => ({})) as { error?: string; message?: string };
          this.serverError = json.error ?? json.message ?? \`Submission failed (\${res.status})\`;
          return;
        }
        this.success = true;
      } catch {
        this.serverError = "Network error — please try again.";
      } finally {
        this.submitting = false;
      }
    },
  },
});
</script>
`;
}

// ---------------------------------------------------------------------------
// Svelte snippet
// ---------------------------------------------------------------------------

function svelteSnippet(input: SnippetInput): string {
  const { endpoint, fields, captchaEnabled, hasFileUpload } = input;

  const stateDecls = fields.map((f) => {
    const t = inputType(f);
    if (t === "checkbox") return `  let ${f.name} = false;`;
    if (t === "file") return `  let ${f.name}: File | null = null;`;
    return `  let ${f.name} = "";`;
  }).join("\n");

  const formObj = fields.map((f) => `    ${f.name},`).join("\n");

  const validationChecks = fields
    .filter((f) => f.required)
    .map((f) => {
      const t = inputType(f);
      if (t === "checkbox") return `  if (!${f.name}) errs.${f.name} = "${fieldLabel(f)} is required";`;
      if (t === "file") return `  if (!${f.name}) errs.${f.name} = "${fieldLabel(f)} is required";`;
      return `  if (!String(${f.name}).trim()) errs.${f.name} = "${fieldLabel(f)} is required";`;
    }).join("\n");

  const bodyBlock = hasFileUpload
    ? `    const body = new FormData();
    const formData = { ${fields.map((f) => f.name).join(", ")} };
    for (const [k, v] of Object.entries(formData)) {
      if (v instanceof File) body.append(k, v);
      else if (typeof v === "boolean") body.append(k, v ? "true" : "false");
      else if (v !== null) body.append(k, String(v));
    }${captchaEnabled ? `\n    body.append("cf-turnstile-response", turnstileToken);` : ""}`
    : `    const payload: Record<string, unknown> = {
${formObj}
    };${captchaEnabled ? `\n    payload["cf-turnstile-response"] = turnstileToken;` : ""}
    const body = JSON.stringify(payload);`;

  const contentTypeHeader = hasFileUpload
    ? `// FormData sets Content-Type automatically`
    : `"Content-Type": "application/json",`;

  const svelteInputs = fields.map((f) => {
    const t = inputType(f);
    const lbl = fieldLabel(f);
    const errId = `${f.name}-error`;
    const req = f.required ? " required" : "";

    if (t === "textarea") {
      return [
        `  <div class="field">`,
        `    <label for="${f.name}">${lbl}${f.required ? " *" : ""}</label>`,
        `    <textarea id="${f.name}" bind:value={${f.name}} aria-invalid={!!errors?.${f.name}} aria-describedby="${errId}"${req} />`,
        `    {#if errors?.${f.name}}<span id="${errId}" role="alert">{errors.${f.name}}</span>{/if}`,
        `  </div>`,
      ].join("\n");
    }
    if (t === "checkbox") {
      return [
        `  <div class="field field--checkbox">`,
        `    <label>`,
        `      <input id="${f.name}" type="checkbox" bind:checked={${f.name}} aria-invalid={!!errors?.${f.name}} aria-describedby="${errId}"${req} />`,
        `      ${lbl}${f.required ? " *" : ""}`,
        `    </label>`,
        `    {#if errors?.${f.name}}<span id="${errId}" role="alert">{errors.${f.name}}</span>{/if}`,
        `  </div>`,
      ].join("\n");
    }
    if (t === "file") {
      return [
        `  <div class="field">`,
        `    <label for="${f.name}">${lbl}${f.required ? " *" : ""}</label>`,
        `    <input id="${f.name}" type="file" on:change={(e) => { ${f.name} = (e.target as HTMLInputElement).files?.[0] ?? null; }} aria-invalid={!!errors?.${f.name}} aria-describedby="${errId}"${req} />`,
        `    {#if errors?.${f.name}}<span id="${errId}" role="alert">{errors.${f.name}}</span>{/if}`,
        `  </div>`,
      ].join("\n");
    }
    return [
      `  <div class="field">`,
      `    <label for="${f.name}">${lbl}${f.required ? " *" : ""}</label>`,
      `    <input id="${f.name}" type="${t}" bind:value={${f.name}} aria-invalid={!!errors?.${f.name}} aria-describedby="${errId}"${req} />`,
      `    {#if errors?.${f.name}}<span id="${errId}" role="alert">{errors.${f.name}}</span>{/if}`,
      `  </div>`,
    ].join("\n");
  }).join("\n");

  const turnstileMount = captchaEnabled
    ? `
  import { onMount } from "svelte";
  let turnstileToken = "";
  onMount(() => {
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    script.async = true;
    document.body.appendChild(script);
    script.onload = () => {
      (window as unknown as { turnstile: { render: (el: string, opts: Record<string, unknown>) => void } }).turnstile.render(
        "#turnstile-container",
        {
          sitekey: "<YOUR_TURNSTILE_SITE_KEY>",
          callback: (token: string) => { turnstileToken = token; },
        },
      );
    };
  });
`
    : "";

  const turnstileGuard = captchaEnabled
    ? `  if (!turnstileToken) { serverError = "Please complete the CAPTCHA."; return; }\n` : "";

  const turnstileWidget = captchaEnabled ? `\n  <!-- Cloudflare Turnstile -->\n  <div id="turnstile-container" />\n` : "";

  return `<script lang="ts">
  // SECURITY: No API key is needed or accepted. The endpoint is public and
  // identified only by the form ID embedded in the URL. Do not add credentials.
  const ENDPOINT = "${endpoint}";
${turnstileMount}
${stateDecls}
  let errors: Partial<Record<string, string>> = {};
  let submitting = false;
  let serverError: string | null = null;
  let success = false;

  function validate(): boolean {
    const errs: Partial<Record<string, string>> = {};
${validationChecks}
    errors = errs;
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    if (submitting) return;
${turnstileGuard}
    submitting = true;
    serverError = null;
    try {
${bodyBlock}
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          ${contentTypeHeader}
          Accept: "application/json",
        },
        body,
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({})) as { error?: string; message?: string };
        serverError = json.error ?? json.message ?? \`Submission failed (\${res.status})\`;
        return;
      }
      success = true;
    } catch {
      serverError = "Network error — please try again.";
    } finally {
      submitting = false;
    }
  }
</script>

{#if success}
  <div role="status" aria-live="polite">
    <p>Thank you! Your message has been received.</p>
  </div>
{:else}
  <form on:submit|preventDefault={handleSubmit} novalidate>
    {#if serverError}
      <div role="alert" style="color: red">{serverError}</div>
    {/if}
${svelteInputs}${turnstileWidget}
    <button type="submit" disabled={submitting} aria-busy={submitting}>
      {submitting ? "Sending…" : "Send"}
    </button>
  </form>
{/if}
`;
}

// ---------------------------------------------------------------------------
// Astro snippet
// ---------------------------------------------------------------------------

function astroSnippet(input: SnippetInput): string {
  // Astro islands: emit a React component with client:load directive.
  const reactCode = reactSnippet({ ...input, flavour: "react" });
  return `---
// ContactForm.astro
// Import the React component as an island for client-side interactivity.
import ContactFormReact from "./ContactForm";
---

<ContactFormReact client:load />

{/* ContactForm.tsx — place in the same directory */}
{/* Paste the following React component into ContactForm.tsx: */}

${reactCode}
`;
}

// ---------------------------------------------------------------------------
// HTML snippet
// ---------------------------------------------------------------------------

function htmlSnippet(input: SnippetInput): string {
  const { endpoint, fields, captchaEnabled, hasFileUpload } = input;

  const htmlInputs = fields.map((f) => {
    const t = inputType(f);
    const lbl = fieldLabel(f);
    const req = f.required ? " required" : "";
    const errId = `${f.name}-error`;

    if (t === "textarea") {
      return [
        `    <div class="field">`,
        `      <label for="${f.name}">${lbl}${f.required ? " *" : ""}</label>`,
        `      <textarea id="${f.name}" name="${f.name}" aria-describedby="${errId}"${req}></textarea>`,
        `      <span id="${errId}" class="field-error" role="alert" hidden></span>`,
        `    </div>`,
      ].join("\n");
    }
    if (t === "checkbox") {
      return [
        `    <div class="field field--checkbox">`,
        `      <label>`,
        `        <input id="${f.name}" name="${f.name}" type="checkbox" aria-describedby="${errId}"${req}>`,
        `        ${lbl}${f.required ? " *" : ""}`,
        `      </label>`,
        `      <span id="${errId}" class="field-error" role="alert" hidden></span>`,
        `    </div>`,
      ].join("\n");
    }
    return [
      `    <div class="field">`,
      `      <label for="${f.name}">${lbl}${f.required ? " *" : ""}</label>`,
      `      <input id="${f.name}" name="${f.name}" type="${t}" aria-describedby="${errId}"${req}>`,
      `      <span id="${errId}" class="field-error" role="alert" hidden></span>`,
      `    </div>`,
    ].join("\n");
  }).join("\n");

  const turnstileScript = captchaEnabled
    ? `  <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async></script>\n`
    : "";
  const turnstileWidget = captchaEnabled
    ? `\n    <!-- Cloudflare Turnstile -->\n    <div class="cf-turnstile" data-sitekey="<YOUR_TURNSTILE_SITE_KEY>"></div>\n`
    : "";

  const validationJS = fields
    .filter((f) => f.required)
    .map((f) => {
      const t = inputType(f);
      const errId = `${f.name}-error`;
      if (t === "checkbox") {
        return [
          `    var cb_${f.name} = form.elements["${f.name}"];`,
          `    if (cb_${f.name} && !cb_${f.name}.checked) {`,
          `      document.getElementById("${errId}").textContent = "${fieldLabel(f)} is required";`,
          `      document.getElementById("${errId}").hidden = false;`,
          `      cb_${f.name}.setAttribute("aria-invalid", "true");`,
          `      valid = false;`,
          `    }`,
        ].join("\n");
      }
      return [
        `    var el_${f.name} = form.elements["${f.name}"];`,
        `    if (el_${f.name} && !el_${f.name}.value.trim()) {`,
        `      document.getElementById("${errId}").textContent = "${fieldLabel(f)} is required";`,
        `      document.getElementById("${errId}").hidden = false;`,
        `      el_${f.name}.setAttribute("aria-invalid", "true");`,
        `      valid = false;`,
        `    }`,
      ].join("\n");
    }).join("\n");

  const clearErrorsJS = fields.map((f) => {
    const errId = `${f.name}-error`;
    return [
      `    document.getElementById("${errId}").hidden = true;`,
      `    document.getElementById("${errId}").textContent = "";`,
      `    var fe = form.elements["${f.name}"]; if (fe) fe.removeAttribute("aria-invalid");`,
    ].join("\n");
  }).join("\n");

  const bodyBlock = hasFileUpload
    ? `      var body = new FormData(form);${captchaEnabled ? `\n      var token = document.querySelector('[name="cf-turnstile-response"]'); if (token) body.append("cf-turnstile-response", token.value);` : ""}`
    : captchaEnabled
    ? `      var rawData = {};
      Array.from(new FormData(form).entries()).forEach(function(e) { rawData[e[0]] = e[1]; });
      var tsToken = document.querySelector('[name="cf-turnstile-response"]');
      if (tsToken) rawData["cf-turnstile-response"] = tsToken.value;
      var body = JSON.stringify(rawData);`
    : `      var body = JSON.stringify(Object.fromEntries(new FormData(form).entries()));`;

  const contentTypeHeader = hasFileUpload
    ? `// FormData sets Content-Type automatically — no explicit header needed`
    : `headers: { "Content-Type": "application/json", "Accept": "application/json" },`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Contact</title>
${turnstileScript}</head>
<body>

<div id="form-success" role="status" aria-live="polite" hidden>
  <p>Thank you! Your message has been received.</p>
</div>

<form id="contact-form" novalidate>
  <div id="server-error" role="alert" style="color:red" hidden></div>
${htmlInputs}${turnstileWidget}
  <button type="submit" id="submit-btn">Send</button>
</form>

<script>
// SECURITY: No API key is needed or accepted. The endpoint is public and
// identified only by the form ID embedded in the URL. Do not add credentials.
var ENDPOINT = "${endpoint}";

var form = document.getElementById("contact-form");
var submitBtn = document.getElementById("submit-btn");
var serverErrorEl = document.getElementById("server-error");
var successEl = document.getElementById("form-success");
var submitting = false;

form.addEventListener("submit", function(e) {
  e.preventDefault();
  if (submitting) return;

  // Clear previous errors.
${clearErrorsJS}
  serverErrorEl.hidden = true;
  serverErrorEl.textContent = "";

  // Validate.
  var valid = true;
${validationJS}
  if (!valid) return;

  submitting = true;
  submitBtn.disabled = true;
  submitBtn.textContent = "Sending…";

${bodyBlock}

  fetch(ENDPOINT, {
    method: "POST",
    ${contentTypeHeader}
    body: body,
  })
  .then(function(res) {
    if (!res.ok) {
      return res.json().catch(function() { return {}; }).then(function(json) {
        serverErrorEl.textContent = json.error || json.message || ("Submission failed (" + res.status + ")");
        serverErrorEl.hidden = false;
      });
    }
    form.hidden = true;
    successEl.hidden = false;
  })
  .catch(function() {
    serverErrorEl.textContent = "Network error — please try again.";
    serverErrorEl.hidden = false;
  })
  .finally(function() {
    submitting = false;
    submitBtn.disabled = false;
    submitBtn.textContent = "Send";
  });
});
</script>

</body>
</html>
`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a complete, copy-pasteable integration snippet for the given flavour.
 * Returns an empty string for flavour "none" (visual editors with no code agent).
 *
 * SECURITY: This function never accepts, reads, or emits API keys, management
 * keys, session tokens, or installation tokens. Do not add such parameters.
 */
export function generateSnippet(input: SnippetInput): string {
  switch (input.flavour) {
    case "react":
      return reactSnippet(input);
    case "nextjs":
      return nextjsSnippet(input);
    case "vue":
      return vueSnippet(input);
    case "svelte":
      return svelteSnippet(input);
    case "astro":
      return astroSnippet(input);
    case "html":
      return htmlSnippet(input);
    case "none":
      return "";
  }
}
