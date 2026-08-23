/**
 * scan-file handler.
 *
 * IDEMPOTENCY: Checks submission_files.scan_status before dispatching to the
 * AV scanner. If scanStatus is not 'pending', the file was already processed
 * (or is being processed concurrently) and this job is a no-op.
 *
 * DELIVERY GUARANTEE: Scan failures nack the job. After max attempts the file
 * is marked 'error' so it does not block submission processing indefinitely.
 */

import type { Job } from "../queue.js";

export interface ScanFilePayload {
  submissionFileId: string;
  submissionId: string;
  workspaceId: string;
  storageKey: string;
  storageBucket: string;
}

export async function handleScanFile(job: Job<unknown>): Promise<void> {
  const payload = job.payload as ScanFilePayload;
  const { submissionFileId, storageKey } = payload;

  // IDEMPOTENCY: Only process files still in 'pending' state.
  // TODO: const file = await db.query.submissionFiles.findFirst(...)
  // if (file.scanStatus !== 'pending') return;

  console.log(
    `[scan-file] Scanning file ${submissionFileId} at ${storageKey} (attempt ${job.attemptNumber})`,
  );

  // TODO:
  //   1. Retrieve file bytes from object storage.
  //   2. Call AV scanning API.
  //   3. UPDATE submission_files SET scanStatus, scanCompletedAt, scanResult.
  //   4. If malicious: soft-delete the file, flag submission, notify workspace.
}
