# 22 — SDK

Sources: `packages/sdk/src/`, `packages/react/src/`.

## Status

Both SDKs are **fully implemented** as source code. They have never been compiled or published because the npm registry was firewalled during development. The packages `@submitpulse/browser` and `@submitpulse/react` do not exist in any registry.

For users who cannot install packages, the snippet generator in `packages/config/src/snippets.ts` produces complete, copy-pasteable vanilla JavaScript or framework-specific code.

---

## `@submitpulse/browser`

**Entry point**: `packages/sdk/src/index.ts`

**Design goals** (from source):
- Zero runtime dependencies (no axios, no lodash, no polyfills).
- Works in every modern browser and in Node 18+.
- File/FileList values are automatically serialised as multipart FormData; plain objects go as JSON. Callers never choose the encoding.
- Structured, discriminated error types let consumers switch exhaustively.

### `createClient(opts: CreateClientOptions): SubmitPulseClient`

The primary export. Creates a client bound to a single form endpoint.

```typescript
import { createClient } from "@submitpulse/browser";

// Option A: pass your form ID (recommended)
const client = createClient({ publicFormId: "fm_abc123" });

// Option B: pass the full endpoint URL
const client = createClient({
  endpoint: "https://api.submitpulse.com/v1/forms/fm_abc123/submissions"
});

// Option C: test environments
const client = createClient({
  publicFormId: "fm_abc123",
  baseUrl: "http://localhost:8787",
});
```

`CreateClientOptions`:

| Field | Type | Description |
|---|---|---|
| `publicFormId` | `string` optional | Form ID (prefix `fm_`). Combined with `baseUrl` to build the endpoint. |
| `endpoint` | `string` optional | Full submission URL. Takes precedence over `publicFormId`. |
| `baseUrl` | `string` optional | Override the API base URL. Defaults to `https://api.submitpulse.com`. |

At least one of `publicFormId` or `endpoint` is required.

### `client.submit(data, opts?): Promise<SubmitResult>`

```typescript
const result = await client.submit(
  { email: "user@example.com", message: "Hello" },
  {
    idempotencyKey: generateIdempotencyKey(),
    timeoutMs: 15_000,
    turnstileToken: "...",  // from window.turnstile.render
  }
);
// result.submissionId — "sub_..."
// result.requestId   — x-submitpulse-request-id header value, for tracing
```

`SubmitOptions`:

| Field | Type | Default | Description |
|---|---|---|---|
| `idempotencyKey` | `string` | none | Enables safe retries and deduplication. See below. |
| `timeoutMs` | `number` | `30000` | Abort the request after N ms. Pass `0` to disable. |
| `turnstileToken` | `string` | none | Cloudflare Turnstile token. Required when Turnstile is enabled on the form. |
| `signal` | `AbortSignal` | none | External cancellation. Combined with the timeout signal (whichever fires first). |

### Retry policy

- Retries on network failure and 5xx only. Never on 4xx.
- Maximum 2 retries with exponential back-off: 200 ms, 400 ms.
- **Retries only occur when `idempotencyKey` is provided.** Without a key, the client cannot safely retry because it cannot know whether the server committed the first attempt. Without an idempotency key, a 5xx surfaces immediately as a `ServerError`.

### Error classes

All errors extend `SubmitPulseError`. Switch on `error.kind`:

| Class | `kind` | When thrown |
|---|---|---|
| `ValidationError` | `"validation"` | HTTP 422 — one or more field values rejected |
| `RateLimitError` | `"rate_limit"` | HTTP 429 — too many requests from this IP/form |
| `OriginError` | `"origin"` | HTTP 403 — the page's origin is not in the form's allow-list |
| `NetworkError` | `"network"` | Fetch threw — network failure, DNS error, or abort |
| `ServerError` | `"server"` | HTTP 5xx — transient server fault |

`ValidationError` exposes:

```typescript
error.fieldErrors: readonly ValidationFieldError[]
// [{ field: "email", message: "Invalid email address", code: "invalid_email" }]

error.fieldMessages: Record<string, string>
// { email: "Invalid email address" }
```

`RateLimitError` exposes:

```typescript
error.retryAfter: number | undefined  // seconds, from Retry-After header
```

### Idempotency helpers

`generateIdempotencyKey(): string` — produces a random UUID using `crypto.randomUUID()` (with a fallback to `crypto.getRandomValues`).

`IdempotencyKeyManager` — per-component helper:

```typescript
const key = new IdempotencyKeyManager();

// On submit:
await client.submit(data, { idempotencyKey: key.current });

// On definitive result (success or non-retriable error):
key.reset(); // rotates to a fresh key for the next attempt
```

### File uploads

Pass `File` or `FileList` values in the data object. The client detects them automatically and uses `multipart/form-data`. Plain objects use `application/json`.

```typescript
const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
await client.submit({
  name: "Alice",
  attachment: fileInput.files![0],  // detected as File → multipart
});
```

---

## `@submitpulse/react`

**Entry point**: `packages/react/src/index.ts`

**Peer dependencies**: `react >= 18`, `@submitpulse/browser`.

**Exports**:

```typescript
// Context provider
SubmitPulseProvider, SubmitPulseProviderProps, useSubmitPulseClient

// Primary hook
useSubmitPulseForm, UseSubmitPulseFormOptions, UseSubmitPulseFormReturn

// Pre-built components
SubmitPulseForm, SubmitPulseFormProps
SubmitButton, SubmitButtonProps
FormStatus, FormStatusProps
```

### Provider setup

Wrap your form subtree with `SubmitPulseProvider`. Pass either `publicFormId` or `endpoint`.

```tsx
import { SubmitPulseProvider } from "@submitpulse/react";

export default function ContactPage() {
  return (
    <SubmitPulseProvider publicFormId="fm_abc123">
      <ContactForm />
    </SubmitPulseProvider>
  );
}
```

### `useSubmitPulseForm`

Manages the full submission lifecycle. Prevents concurrent submits (a second call while one is in-flight is silently dropped until the first settles).

```tsx
import { useSubmitPulseForm } from "@submitpulse/react";
import { generateIdempotencyKey } from "@submitpulse/browser";

function ContactForm() {
  const { submit, isSubmitting, isSuccess, error, fieldErrors, reset } =
    useSubmitPulseForm({
      onSuccess: (result) => {
        console.log("Submitted!", result.submissionId);
      },
      onError: (err) => {
        console.error("Failed:", err);
      },
    });

  if (isSuccess) {
    return (
      <div>
        <p>Thank you!</p>
        <button onClick={reset}>Send another</button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.currentTarget));
        submit(data);
      }}
    >
      <input name="email" type="email" />
      {fieldErrors.email && <span>{fieldErrors.email}</span>}

      <textarea name="message" />
      {fieldErrors.message && <span>{fieldErrors.message}</span>}

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Sending…" : "Send"}
      </button>
    </form>
  );
}
```

`UseSubmitPulseFormReturn`:

| Field | Type | Description |
|---|---|---|
| `submit` | `(data: Record<string, unknown>) => Promise<void>` | Fire the submission. Drops concurrent calls. |
| `isSubmitting` | `boolean` | True while a request is in-flight. |
| `isSuccess` | `boolean` | True after a successful submission. Reset by `reset()`. |
| `error` | `unknown` | The last error. Undefined after success. |
| `fieldErrors` | `Record<string, string>` | Per-field validation messages from a 422 response. |
| `reset` | `() => void` | Clear `isSuccess`, `error`, `fieldErrors` without reloading. |

`UseSubmitPulseFormOptions`:

| Field | Type | Description |
|---|---|---|
| `submitOptions` | `Omit<SubmitOptions, "signal">` | Passed through to `client.submit`. |
| `onSuccess` | `(result: SubmitResult) => void` | Called after success. |
| `onError` | `(error: unknown) => void` | Called after any failure. |

### Pre-built components

`SubmitPulseForm`, `SubmitButton`, and `FormStatus` are opinionated wrappers for common patterns. Their prop types are exported from `packages/react/src/components.ts`. These exist as source; they have not been rendered in a browser.

---

## Alternative: generated snippets

For users who do not install an npm package, the snippet generator (`packages/config/src/snippets.ts`) produces complete, self-contained code. The MCP tool `generate_integration` uses the same generator. The generated HTML snippet requires no build tooling:

```html
<form id="sp-form">
  <input name="email" type="email" required />
  <textarea name="message" required></textarea>
  <button type="submit">Send</button>
</form>
<script type="module">
  document.getElementById("sp-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    const res = await fetch("https://api.submitpulse.com/v1/forms/fm_abc123/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      document.getElementById("sp-form").innerHTML = "<p>Thank you!</p>";
    }
  });
</script>
```
