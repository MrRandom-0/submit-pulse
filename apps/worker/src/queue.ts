/**
 * QueueDriver — abstracts the message-queue transport.
 *
 * Two implementations are provided:
 *   InMemoryQueueDriver  — development / testing; no external dependency.
 *   CloudflareQueueDriver — INCOMPLETE; requires Cloudflare Queues bindings.
 *
 * DELIVERY GUARANTEE:
 * The driver must deliver each message AT LEAST ONCE. Workers must be
 * idempotent (see individual handlers). A message is acknowledged only after
 * the handler returns successfully; on failure it is nacked and re-enqueued
 * for retry. After max attempts the driver moves it to the dead-letter path
 * so it is never silently lost.
 */

export type JobType =
  | "process-submission"
  | "send-notification"
  | "send-autoresponder"
  | "deliver-webhook"
  | "scan-file"
  | "run-health-check"
  | "enrich-analytics"
  | "sweep-retention";

export interface Job<T = unknown> {
  type: JobType;
  /** Unique job ID for idempotency tracking. */
  id: string;
  payload: T;
  /** Zero-based attempt count. Incremented by the driver on each redelivery. */
  attemptNumber: number;
}

export interface QueueDriver {
  enqueue<T>(job: Omit<Job<T>, "attemptNumber">): Promise<void>;
  /** Register a handler for all job types. */
  consume(handler: (job: Job<unknown>) => Promise<void>): Promise<void>;
}

/* -------------------------------------------------------------------------- */
/* InMemoryQueueDriver                                                         */
/* -------------------------------------------------------------------------- */

export class InMemoryQueueDriver implements QueueDriver {
  private readonly queue: Array<Job<unknown>> = [];
  private handler: ((job: Job<unknown>) => Promise<void>) | null = null;
  private running = false;

  async enqueue<T>(job: Omit<Job<T>, "attemptNumber">): Promise<void> {
    this.queue.push({ ...job, attemptNumber: 0 } as Job<unknown>);
    if (this.handler && !this.running) {
      void this._drain();
    }
  }

  async consume(handler: (job: Job<unknown>) => Promise<void>): Promise<void> {
    this.handler = handler;
    if (this.queue.length > 0 && !this.running) {
      await this._drain();
    }
  }

  private async _drain(): Promise<void> {
    if (!this.handler) return;
    this.running = true;
    while (this.queue.length > 0) {
      const job = this.queue.shift()!;
      try {
        await this.handler(job);
      } catch {
        // Re-enqueue with incremented attempt count (simple retry for dev).
        if (job.attemptNumber < 3) {
          this.queue.push({ ...job, attemptNumber: job.attemptNumber + 1 });
        }
        // After 3 attempts, drop to dead-letter (logged only in dev).
        else {
          console.error(`[InMemoryQueue] Dead-lettered job ${job.id} (${job.type})`);
        }
      }
    }
    this.running = false;
  }
}

/* -------------------------------------------------------------------------- */
/* CloudflareQueueDriver — INCOMPLETE                                          */
/* -------------------------------------------------------------------------- */

/**
 * INCOMPLETE — requires the following Cloudflare Workers bindings in wrangler.toml:
 *
 *   [[queues.producers]]
 *   queue = "submitpulse-jobs"
 *   binding = "JOB_QUEUE"
 *
 *   [[queues.consumers]]
 *   queue = "submitpulse-jobs"
 *   max_batch_size = 10
 *   max_batch_timeout = 5
 *   max_retries = 6
 *   dead_letter_queue = "submitpulse-jobs-dlq"
 *
 *   [[queues.producers]]
 *   queue = "submitpulse-jobs-dlq"
 *   binding = "DLQ_QUEUE"
 *
 * The consumer is registered via the `queue` export in the Worker entry point
 * (apps/worker/src/index.ts), not via consume() in this driver. This class
 * only wraps the producer (enqueue) side for compatibility with the QueueDriver
 * interface used in test environments.
 */

// Minimal Cloudflare Queue producer interface to avoid importing the CF types package.
interface CfQueue {
  send(body: unknown): Promise<void>;
}

export class CloudflareQueueDriver implements QueueDriver {
  constructor(private readonly binding: CfQueue) {}

  async enqueue<T>(job: Omit<Job<T>, "attemptNumber">): Promise<void> {
    await this.binding.send({ ...job, attemptNumber: 0 });
  }

  async consume(_handler: (job: Job<unknown>) => Promise<void>): Promise<void> {
    // INCOMPLETE: In Cloudflare Workers the consumer is invoked via the
    // `queue` export of the Worker, not via this method. Wire the handler
    // in apps/worker/src/index.ts instead.
    throw new Error(
      "CloudflareQueueDriver.consume() is not supported. " +
        "Register the handler via the Worker `queue` export in index.ts.",
    );
  }
}
