/**
 * @submitpulse/browser — Submit Pulse browser SDK
 *
 * Published package name: @submitpulse/browser
 * Zero runtime dependencies. Works in browsers and Node 18+.
 */

export { createClient } from "./client.js";
export type { SubmitPulseClient } from "./client.js";
export type { CreateClientOptions, SubmitOptions, SubmitResult, ValidationFieldError } from "./types.js";

export {
  SubmitPulseError,
  ValidationError,
  RateLimitError,
  OriginError,
  NetworkError,
  ServerError,
} from "./errors.js";

export {
  generateIdempotencyKey,
  IdempotencyKeyManager,
} from "./idempotency.js";
