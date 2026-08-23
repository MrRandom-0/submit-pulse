# `@submitpulse/browser`

Zero-dependency browser SDK for [Submit Pulse](https://submitpulse.com). Works in
every modern browser and Node 18+.

> **Plain fetch also works fine.** This SDK adds typed errors, automatic
> multipart detection for file uploads, idempotency helpers and automatic
> retries. You do not need it for a basic integration.

## Install

```bash
npm install @submitpulse/browser
```

## Basic usage

```ts
import { createClient } from "@submitpulse/browser";

const client = createClient({ publicFormId: "fm_abc123" });

const result = await client.submit({
  email: "user@example.com",
  message: "Hello!",
});

console.log(result.submissionId); // sub_…
```

## File uploads

Files are detected automatically. Pass `File` or `FileList` values and the
request is sent as `multipart/form-data`.

```ts
const fileInput = document.querySelector<HTMLInputElement>("#attachment")!;

await client.submit({
  name: "Alice",
  attachment: fileInput.files, // FileList — all files are included
});
```

## Idempotency (prevent double-submit)

```ts
import { createClient, IdempotencyKeyManager } from "@submitpulse/browser";

const client = createClient({ publicFormId: "fm_abc123" });
const keyManager = new IdempotencyKeyManager();

async function handleSubmit(data: Record<string, unknown>) {
  try {
    const result = await client.submit(data, {
      idempotencyKey: keyManager.current,
    });
    keyManager.reset(); // rotate key for the next submit
    return result;
  } catch (err) {
    // Do NOT reset on error — keep the same key so a retry is safe.
    throw err;
  }
}
```

## Turnstile (bot protection)

```ts
const token = await new Promise<string>((resolve) => {
  window.turnstile.render("#turnstile-container", {
    sitekey: "0x…",
    callback: resolve,
  });
});

await client.submit(data, { turnstileToken: token });
```

## Typed error handling

All errors extend `SubmitPulseError` and carry a `kind` discriminant.

```ts
import {
  createClient,
  ValidationError,
  RateLimitError,
  OriginError,
  NetworkError,
  ServerError,
} from "@submitpulse/browser";

const client = createClient({ publicFormId: "fm_abc123" });

try {
  await client.submit(formData);
} catch (err) {
  if (!(err instanceof SubmitPulseError)) throw err; // re-throw unknown errors

  switch (err.kind) {
    case "validation":
      // err is ValidationError
      console.error("Field errors:", err.fieldMessages);
      // { email: "Invalid email address", name: "Required" }
      break;

    case "rate_limit":
      // err is RateLimitError
      console.warn(`Try again in ${err.retryAfter ?? "a moment"} seconds`);
      break;

    case "origin":
      // err is OriginError — add the page domain to the form's allowed origins
      console.error("Origin not allowed:", err.message);
      break;

    case "network":
      // err is NetworkError — fetch threw (offline, DNS, timeout, abort)
      console.error("Network failure:", err.cause);
      break;

    case "server":
      // err is ServerError — 5xx from the API
      console.error("Server error:", err.statusCode);
      break;
  }
}
```

## Custom endpoint / self-hosted

```ts
const client = createClient({
  endpoint: "https://my-proxy.example.com/api/form",
});
```

## Timeout

Default is 30 seconds. Override per call:

```ts
await client.submit(data, { timeoutMs: 10_000 }); // 10 s
await client.submit(data, { timeoutMs: 0 });        // disabled
```

## Retry policy

Retries happen **only** on network failure and 5xx responses. 4xx responses
are **never** retried — they are definitive. Retries are only attempted when an
idempotency key is present; without one, a retry could create a duplicate
submission.
