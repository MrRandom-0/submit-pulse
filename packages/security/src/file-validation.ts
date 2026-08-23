/**
 * File validation for form submissions.
 *
 * Layers of defence (all required; passing one does not skip the others):
 *   1. Extension allowlist — reject outright if not in the set.
 *   2. Declared MIME type — checked against the extension allowlist.
 *   3. Magic-byte / file-signature sniffing — must agree with declared type.
 *   4. Size limits — per-file and aggregate.
 *   5. Server-generated storage key — the client filename is NEVER used in
 *      a storage path; only in the `original_filename` display column.
 *   6. Executable and double-extension rejection.
 */

import { sha256HexBytes } from "./hash.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FileValidationOptions {
  /** File extensions the form is configured to accept (without leading dot). */
  readonly allowedExtensions: readonly string[];
  /** MIME types the form is configured to accept. */
  readonly allowedMimeTypes: readonly string[];
  /** Maximum size for a single file, in bytes. */
  readonly maxFileSizeBytes: number;
  /** Maximum number of files per submission. */
  readonly maxFileCount: number;
}

export interface ValidatedFile {
  /** Original client-supplied filename, for display only. */
  readonly originalFilename: string;
  /**
   * Server-generated storage key.
   * Deliberately opaque — based on content hash + random suffix.
   * NEVER derived from the client filename.
   */
  readonly storageKey: string;
  readonly sizeBytes: number;
  /** MIME type as detected server-side via magic bytes. */
  readonly detectedMimeType: string;
  /** MIME type as declared by the browser. May differ from detected. */
  readonly declaredMimeType: string;
  /** SHA-256 hex of the file content. */
  readonly contentHash: string;
}

export class FileValidationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly field?: string,
  ) {
    super(message);
    this.name = "FileValidationError";
  }
}

// ---------------------------------------------------------------------------
// Blocked executable extensions (reject regardless of MIME)
// ---------------------------------------------------------------------------

const BLOCKED_EXTENSIONS = new Set([
  "exe", "dll", "bat", "cmd", "com", "ps1", "psm1", "psd1",
  "vbs", "vbe", "js", "jse", "wsf", "wsh", "msi", "msp",
  "sh", "bash", "zsh", "fish", "ksh", "csh", "tcsh",
  "py", "pyc", "pyw", "rb", "pl", "php", "php3", "php4", "php5",
  "phtml", "asp", "aspx", "cfm", "cgi", "jar", "war", "ear",
  "app", "dmg", "pkg", "deb", "rpm", "run", "bin",
  "apk", "ipa", "xpi", "crx",
  "lnk", "scf", "inf", "reg",
  "svg", // SVG can contain script; only allow if explicitly opted-in
]);

// ---------------------------------------------------------------------------
// Magic-byte signatures
// ---------------------------------------------------------------------------

interface MagicSignature {
  readonly offset: number;
  readonly bytes: readonly number[];
  readonly mimeType: string;
}

const MAGIC_SIGNATURES: readonly MagicSignature[] = [
  // Images
  { offset: 0, bytes: [0xff, 0xd8, 0xff], mimeType: "image/jpeg" },
  { offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], mimeType: "image/png" },
  { offset: 0, bytes: [0x47, 0x49, 0x46, 0x38], mimeType: "image/gif" },
  { offset: 0, bytes: [0x52, 0x49, 0x46, 0x46], mimeType: "image/webp" }, // RIFF header; webp follows
  { offset: 0, bytes: [0x42, 0x4d], mimeType: "image/bmp" },
  { offset: 0, bytes: [0x00, 0x00, 0x01, 0x00], mimeType: "image/x-icon" },
  // PDF
  { offset: 0, bytes: [0x25, 0x50, 0x44, 0x46], mimeType: "application/pdf" },
  // ZIP-based (docx, xlsx, pptx, odt, etc.)
  { offset: 0, bytes: [0x50, 0x4b, 0x03, 0x04], mimeType: "application/zip" },
  // Office legacy
  { offset: 0, bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1], mimeType: "application/msword" },
  // Plain text — no reliable signature; handled by MIME check only
  // Audio
  { offset: 0, bytes: [0x49, 0x44, 0x33], mimeType: "audio/mpeg" }, // MP3 ID3 tag
  { offset: 0, bytes: [0xff, 0xfb], mimeType: "audio/mpeg" }, // MP3 sync
  { offset: 0, bytes: [0x52, 0x49, 0x46, 0x46], mimeType: "audio/wav" }, // WAV (also RIFF)
  // Video
  { offset: 0, bytes: [0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70], mimeType: "video/mp4" },
  { offset: 4, bytes: [0x66, 0x74, 0x79, 0x70], mimeType: "video/mp4" }, // alt MP4
];

/**
 * Detect MIME type from the first N bytes using magic signatures.
 * Returns null if no signature matches — caller decides whether to reject.
 */
function detectMimeFromMagic(header: Uint8Array): string | null {
  for (const sig of MAGIC_SIGNATURES) {
    if (header.length < sig.offset + sig.bytes.length) continue;
    let match = true;
    for (let i = 0; i < sig.bytes.length; i++) {
      if (header[sig.offset + i] !== sig.bytes[i]) {
        match = false;
        break;
      }
    }
    if (match) return sig.mimeType;
  }
  return null;
}

// ---------------------------------------------------------------------------
// MIME family grouping — detected vs declared must be in the same family
// ---------------------------------------------------------------------------

const MIME_FAMILIES: ReadonlyMap<string, string> = new Map([
  ["image/jpeg", "image"],
  ["image/png", "image"],
  ["image/gif", "image"],
  ["image/webp", "image"],
  ["image/bmp", "image"],
  ["image/x-icon", "image"],
  ["image/svg+xml", "image"],
  ["image/tiff", "image"],
  ["application/pdf", "pdf"],
  ["application/zip", "zip"],
  ["application/msword", "office"],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "office"],
  ["application/vnd.ms-excel", "office"],
  ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "office"],
  ["application/vnd.ms-powerpoint", "office"],
  ["application/vnd.openxmlformats-officedocument.presentationml.presentation", "office"],
  ["text/plain", "text"],
  ["text/csv", "text"],
  ["audio/mpeg", "audio"],
  ["audio/wav", "audio"],
  ["audio/ogg", "audio"],
  ["video/mp4", "video"],
  ["video/webm", "video"],
]);

function mimeFamily(mime: string): string {
  return MIME_FAMILIES.get(mime.toLowerCase()) ?? "unknown";
}

// ---------------------------------------------------------------------------
// Extension → canonical MIME mapping
// ---------------------------------------------------------------------------

const EXT_TO_MIME: ReadonlyMap<string, string> = new Map([
  ["jpg", "image/jpeg"],
  ["jpeg", "image/jpeg"],
  ["png", "image/png"],
  ["gif", "image/gif"],
  ["webp", "image/webp"],
  ["bmp", "image/bmp"],
  ["ico", "image/x-icon"],
  ["tif", "image/tiff"],
  ["tiff", "image/tiff"],
  ["pdf", "application/pdf"],
  ["txt", "text/plain"],
  ["csv", "text/csv"],
  ["doc", "application/msword"],
  ["docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  ["xls", "application/vnd.ms-excel"],
  ["xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  ["ppt", "application/vnd.ms-powerpoint"],
  ["pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation"],
  ["zip", "application/zip"],
  ["mp3", "audio/mpeg"],
  ["wav", "audio/wav"],
  ["ogg", "audio/ogg"],
  ["mp4", "video/mp4"],
  ["webm", "video/webm"],
]);

// ---------------------------------------------------------------------------
// Main validator
// ---------------------------------------------------------------------------

/**
 * Validate a single file against the form's file configuration.
 *
 * @param filename      Client-supplied filename (used for ext check + display only).
 * @param declaredMime  MIME type as reported by the browser.
 * @param content       Raw file bytes.
 * @param fieldName     Field key (for error reporting).
 * @param opts          Form file constraints.
 * @returns             ValidatedFile with server-generated storageKey.
 */
export async function validateFile(
  filename: string,
  declaredMime: string,
  content: Uint8Array,
  fieldName: string,
  opts: FileValidationOptions,
): Promise<ValidatedFile> {
  // 1. Size check.
  if (content.length === 0) {
    throw new FileValidationError("File is empty", "FILE_EMPTY", fieldName);
  }
  if (content.length > opts.maxFileSizeBytes) {
    throw new FileValidationError(
      `File exceeds size limit of ${opts.maxFileSizeBytes} bytes`,
      "FILE_TOO_LARGE",
      fieldName,
    );
  }

  // 2. Sanitise and extract extension.
  const safeName = filename.replace(/\0/g, "").trim();
  if (safeName === "") {
    throw new FileValidationError("Filename is empty", "INVALID_FILENAME", fieldName);
  }

  // Double-extension check: "malware.pdf.exe" — reject if more than one dot
  // produces a blocked extension.
  const parts = safeName.split(".");
  if (parts.length > 2) {
    // Check every extension segment after the first for blocked values.
    const nonFirstExts = parts.slice(1);
    for (const seg of nonFirstExts) {
      if (BLOCKED_EXTENSIONS.has(seg.toLowerCase())) {
        throw new FileValidationError(
          `Double-extension attack detected: ${safeName}`,
          "DOUBLE_EXTENSION",
          fieldName,
        );
      }
    }
  }

  const ext = (parts[parts.length - 1] ?? "").toLowerCase();

  // 3. Blocked extension check.
  if (BLOCKED_EXTENSIONS.has(ext)) {
    throw new FileValidationError(
      `Executable or dangerous file type rejected: .${ext}`,
      "BLOCKED_EXTENSION",
      fieldName,
    );
  }

  // 4. Allowlist extension check.
  if (
    opts.allowedExtensions.length > 0 &&
    !opts.allowedExtensions.includes(ext)
  ) {
    throw new FileValidationError(
      `File extension .${ext} is not allowed`,
      "EXTENSION_NOT_ALLOWED",
      fieldName,
    );
  }

  // 5. Declared MIME type allowlist check.
  const normalDeclared = declaredMime.split(";")[0]?.trim().toLowerCase() ?? "";
  if (
    opts.allowedMimeTypes.length > 0 &&
    !opts.allowedMimeTypes.some(
      (m) => m.toLowerCase() === normalDeclared,
    )
  ) {
    throw new FileValidationError(
      `MIME type ${normalDeclared} is not allowed`,
      "MIME_NOT_ALLOWED",
      fieldName,
    );
  }

  // 6. Magic-byte detection — must agree with declared type (same family).
  const header = content.slice(0, 16);
  const detectedMime = detectMimeFromMagic(header);

  if (detectedMime !== null) {
    const declaredFamily = mimeFamily(normalDeclared);
    const detectedFamily = mimeFamily(detectedMime);

    // Zip is a container format for Office Open XML docs — allow that pairing.
    const zipLike = (f: string) => f === "zip" || f === "office";

    if (
      declaredFamily !== detectedFamily &&
      !(zipLike(declaredFamily) && zipLike(detectedFamily))
    ) {
      throw new FileValidationError(
        `Magic bytes indicate ${detectedMime} but declared type is ${normalDeclared}`,
        "MIME_MAGIC_MISMATCH",
        fieldName,
      );
    }
  }

  // 7. Verify declared mime vs extension.
  const canonicalMime = EXT_TO_MIME.get(ext);
  if (canonicalMime !== undefined && normalDeclared !== "" && normalDeclared !== "application/octet-stream") {
    if (mimeFamily(canonicalMime) !== mimeFamily(normalDeclared)) {
      throw new FileValidationError(
        `Extension .${ext} does not match declared MIME type ${normalDeclared}`,
        "EXT_MIME_MISMATCH",
        fieldName,
      );
    }
  }

  // 8. Compute content hash (used for storageKey and deduplication).
  const contentHash = await sha256HexBytes(content);

  // 9. Generate a server-controlled storage key.
  //    Format: <contentHash>/<random>/<sanitised-ext>
  //    The client filename is NEVER part of the storage path.
  const randomSuffix = crypto.randomUUID().replace(/-/g, "");
  const storageKey = `uploads/${contentHash.slice(0, 8)}/${randomSuffix}.${ext}`;

  return {
    originalFilename: safeName,
    storageKey,
    sizeBytes: content.length,
    detectedMimeType: detectedMime ?? normalDeclared,
    declaredMimeType: normalDeclared,
    contentHash,
  };
}

/**
 * Validate that a collection of files does not exceed the per-submission
 * file-count limit. Call this before iterating over individual files.
 */
export function assertFileCountLimit(
  count: number,
  max: number,
  fieldName: string,
): void {
  if (count > max) {
    throw new FileValidationError(
      `Too many files: ${count} (max ${max})`,
      "TOO_MANY_FILES",
      fieldName,
    );
  }
}
