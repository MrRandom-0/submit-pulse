# `@submitpulse/react`

React SDK for [Submit Pulse](https://submitpulse.com). Peer depends on React 18+
and `@submitpulse/browser`.

> **Using this package is entirely optional.** Plain `fetch` or `@submitpulse/browser`
> work fine without React wrappers. This package only removes boilerplate.

## Install

```bash
npm install @submitpulse/browser @submitpulse/react
```

## Quick start

```tsx
import { createClient } from "@submitpulse/browser";
import {
  SubmitPulseProvider,
  SubmitPulseForm,
  SubmitButton,
  FormStatus,
  useSubmitPulseForm,
} from "@submitpulse/react";

const client = createClient({ publicFormId: "fm_abc123" });

export function App() {
  return (
    <SubmitPulseProvider client={client}>
      <ContactForm />
    </SubmitPulseProvider>
  );
}

function ContactForm() {
  const formState = useSubmitPulseForm({
    onSuccess: () => console.log("Sent!"),
  });

  return (
    <SubmitPulseForm formState={formState}>
      <div>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          required
          aria-invalid={formState.fieldErrors["email"] !== undefined}
          aria-describedby="email-error"
        />
        {formState.fieldErrors["email"] && (
          <span id="email-error" role="alert">
            {formState.fieldErrors["email"]}
          </span>
        )}
      </div>

      <div>
        <label htmlFor="message">Message</label>
        <textarea id="message" name="message" required />
      </div>

      <SubmitButton formState={formState}>
        {formState.isSubmitting ? "Sending…" : "Send"}
      </SubmitButton>

      <FormStatus
        formState={formState}
        successMessage="Your message was sent. We'll be in touch."
      />
    </SubmitPulseForm>
  );
}
```

## Render-prop form

```tsx
<SubmitPulseForm formState={formState}>
  {({ isSubmitting, fieldErrors }) => (
    <>
      <input
        name="name"
        aria-invalid={fieldErrors["name"] !== undefined}
      />
      <SubmitButton formState={formState}>
        {isSubmitting ? "Saving…" : "Save"}
      </SubmitButton>
    </>
  )}
</SubmitPulseForm>
```

## Hook only (custom form element)

```tsx
const { submit, isSubmitting, isSuccess, error, fieldErrors, reset } =
  useSubmitPulseForm();

async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.currentTarget));
  await submit(data);
}
```

## API

### `<SubmitPulseProvider client={client}>`

Provides the client to all descendants. Create the client once outside the
component tree to avoid re-creation on render.

### `useSubmitPulseForm(options?)`

| Option | Type | Description |
|--------|------|-------------|
| `submitOptions` | `SubmitOptions` | Passed to `client.submit` (timeout, idempotency key, Turnstile token). |
| `onSuccess` | `(result: SubmitResult) => void` | Called after success. |
| `onError` | `(error: unknown) => void` | Called after failure. |

Returns `{ submit, isSubmitting, isSuccess, error, fieldErrors, reset }`.

Concurrent submits are blocked: calling `submit` while a request is in-flight
is a no-op.

### `<SubmitPulseForm formState={…}>`

Wires `onSubmit` → `FormData` extraction → `formState.submit`. Passes
`aria-busy` while submitting. Accepts `children` or a render prop.

### `<SubmitButton formState={…}>`

Forwards all `<button>` props. Disabled and `aria-disabled` while submitting.

### `<FormStatus formState={…}>`

`aria-live="polite"` region. Renders nothing while idle. Accepts
`successMessage` and `errorMessage` (string or `(error) => string`).
