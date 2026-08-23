/**
 * Stage 8 — File validation.
 *
 * Only runs when the form has `file_uploads_enabled = true` and the request
 * contained file parts (from multipart/form-data).
 *
 * Delegates to @submitpulse/security/file-validation for the actual checks.
 * This stage wraps the result in the ingestion response shape.
 *
 * NOTE: File content scanning (antivirus, malware detection) is deferred
 * to the queue consumer. Files are stored with scan_status = "pending" and
 * must not be served to end-users until scanning completes.
 */

import {
  validateFile,
  assertFileCountLimit,
  FileValidationError,
  type ValidatedFile,
  type FileValidationOptions,
} from "@submitpulse/security/file-validation";
import type { FormFieldRow } from "../types.js";
import { Errors } from "../response.js";

export interface IngestValidatedFile extends ValidatedFile {
  readonly fieldName: string;
}

export async function validateUploadedFiles(
  files: Map<string, File[]>,
  formFields: readonly FormFieldRow[],
  fileUploadsEnabled: boolean,
  requestId: string,
  corsOrigin: string | null,
): Promise<{ validatedFiles: readonly IngestValidatedFile[] } | Response> {
  // If there are no file parts, skip this stage entirely.
  if (files.size === 0) {
    return { validatedFiles: [] };
  }

  // If the form doesn't support file uploads, reject any files.
  if (!fileUploadsEnabled) {
    return Errors.badRequest(
      requestId,
      "This form does not accept file uploads",
      corsOrigin,
    );
  }

  const validatedFiles: IngestValidatedFile[] = [];

  for (const [fieldName, fileList] of files.entries()) {
    // Find the field definition for this file field.
    const fieldDef = formFields.find(
      (f) => f.name === fieldName && f.type === "file",
    );

    const constraints = fieldDef?.constraints ?? {};
    const opts: FileValidationOptions = {
      allowedExtensions: Array.isArray(constraints["allowedMimeTypes"])
        ? [] // extensions derived from MIME allowlist below
        : [],
      allowedMimeTypes: Array.isArray(constraints["allowedMimeTypes"])
        ? (constraints["allowedMimeTypes"] as string[])
        : [],
      maxFileSizeBytes:
        typeof constraints["maxFileSizeBytes"] === "number"
          ? constraints["maxFileSizeBytes"]
          : 10 * 1024 * 1024, // 10 MB default
      maxFileCount:
        typeof constraints["maxFileCount"] === "number"
          ? constraints["maxFileCount"]
          : 5,
    };

    try {
      assertFileCountLimit(fileList.length, opts.maxFileCount, fieldName);
    } catch (err) {
      if (err instanceof FileValidationError) {
        return Errors.validationFailed(
          requestId,
          [{ field: err.field ?? fieldName, code: err.code, message: err.message }],
          corsOrigin,
        );
      }
      return Errors.badRequest(requestId, "File validation failed", corsOrigin);
    }

    for (const file of fileList) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let validated: ValidatedFile;
      try {
        validated = await validateFile(
          file.name,
          file.type,
          bytes,
          fieldName,
          opts,
        );
      } catch (err) {
        if (err instanceof FileValidationError) {
          return Errors.validationFailed(
            requestId,
            [{ field: err.field ?? fieldName, code: err.code, message: err.message }],
            corsOrigin,
          );
        }
        return Errors.badRequest(requestId, "File processing failed", corsOrigin);
      }

      validatedFiles.push({ ...validated, fieldName });
    }
  }

  return { validatedFiles };
}
