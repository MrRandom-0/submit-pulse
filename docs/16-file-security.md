# 16 — File Security

Source: `packages/security/src/file-validation.ts`

## Overview

File uploads are disabled by default (`forms.file_uploads_enabled = false`). When enabled, uploads require Pro plan or above (the `fileUploads` feature flag).

The file validation pipeline applies six layers of defence in strict order.

## Validation layers

### Layer 1: Size check

- Empty files are rejected (`FILE_EMPTY`).
- Files exceeding the per-field `maxFileSizeBytes` constraint are rejected (`FILE_TOO_LARGE`).

### Layer 2: Filename sanitisation and double-extension detection

The filename is sanitised (null bytes stripped). An empty result after sanitisation is rejected (`INVALID_FILENAME`).

Double-extension attack detection: if the filename contains more than one dot, every extension segment after the first is checked against the blocked extension list. A name like `malware.pdf.exe` is rejected (`DOUBLE_EXTENSION`).

### Layer 3: Blocked extension list

The following extensions are blocked regardless of MIME type:

```
exe, dll, bat, cmd, com, ps1, psm1, psd1
vbs, vbe, js, jse, wsf, wsh, msi, msp
sh, bash, zsh, fish, ksh, csh, tcsh
py, pyc, pyw, rb, pl, php, php3, php4, php5, phtml
asp, aspx, cfm, cgi
jar, war, ear
app, dmg, pkg, deb, rpm, run, bin
apk, ipa, xpi, crx
lnk, scf, inf, reg
svg  (can contain script; allowed only if explicitly opted-in)
```

### Layer 4: Allowlist extension check

If `allowedExtensions` is non-empty, the file's extension must be in the list (`EXTENSION_NOT_ALLOWED`).

### Layer 5: Declared MIME type allowlist

If `allowedMimeTypes` is non-empty, the browser-reported MIME type must be in the list after normalisation (stripped of charset parameters).

### Layer 6: Magic-byte detection

The first 16 bytes of the file are compared against a set of magic signatures:

| Format | Magic bytes |
|---|---|
| JPEG | `FF D8 FF` |
| PNG | `89 50 4E 47 0D 0A 1A 0A` |
| GIF | `47 49 46 38` |
| WebP | `52 49 46 46` (RIFF header) |
| PDF | `25 50 44 46` |
| ZIP / OOXML | `50 4B 03 04` |
| Office legacy | `D0 CF 11 E0 A1 B1 1A E1` |
| MP3 ID3 | `49 44 33` |
| MP4 | `66 74 79 70` at offset 4 |

The detected MIME type is compared against the declared MIME type within the same family. Cross-family mismatches are rejected (`MIME_MAGIC_MISMATCH`). ZIP and Office Open XML are treated as the same family (OOXML documents are ZIP files internally).

Files with no matching magic signature pass through (plain text has no reliable signature).

### Layer 7: Extension vs declared MIME consistency

If the extension maps to a canonical MIME type and the declared MIME type maps to a different family, the file is rejected (`EXT_MIME_MISMATCH`).

## Storage key generation

The storage key is server-generated and deliberately opaque:

```
uploads/<first-8-chars-of-SHA256>/<random-UUID-no-dashes>.<ext>
```

The client filename is **never** part of the storage path. It is stored only in `submission_files.original_filename` for display.

## Content hash

SHA-256 of the file content is computed and stored in `submission_files.content_hash`. This enables:
- Deduplication of identical files across submissions.
- Integrity verification after storage.

## Antivirus scanning

File scanning is an async operation in the `scan-file` worker handler. The `submission_files.scan_status` column tracks the lifecycle: `pending` → `scanning` → `clean` / `infected` / `failed` / `quarantined`.

**The `handleScanFile` handler is a stub.** No antivirus provider is integrated. Files remain in `pending` status indefinitely.

Files with `scan_status = 'infected'` or `quarantined` should be inaccessible via download. This enforcement is not yet implemented.

## Download access control

`file:download` permission is required to download submission files. Viewer role does not have this permission. Developer, admin, and owner roles do.

Pre-signed download URLs (via the storage provider) are the intended delivery mechanism. No download endpoint exists in the current codebase.
