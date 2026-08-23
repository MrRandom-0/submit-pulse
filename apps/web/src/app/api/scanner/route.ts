/**
 * POST /api/scanner
 *
 * Accepts { url: string } and runs the form scanner server-side.
 * The scan is done server-side so that:
 *   1. The SSRF guard runs authoritatively (not bypassable from the browser).
 *   2. CORS restrictions on the scanned page don't apply (server fetch).
 *
 * Returns a ScanResult JSON body.
 *
 * SSRF: assertSafeEgressUrl is called inside analyzeUrl() before any fetch.
 * We do not trust the incoming URL at this layer — the scanner package guards it.
 */

import { NextResponse } from "next/server";
import { analyzeUrl } from "@submitpulse/scanner";
import type { PromptContext } from "@submitpulse/config";

// Minimal PromptContext for scanner-generated AI prompts.
// Fields must match real schema; no secrets permitted (see integration-prompts.ts).
const SCANNER_PROMPT_CTX: PromptContext = {
  formName: "Scanned Form",
  publicFormId: "fm_scanner_placeholder00000000",
  endpoint: "https://api.submitpulse.io/f/fm_scanner_placeholder00000000",
  fields: [],
  allowedOrigin: null,
  captchaEnabled: false,
  hasFileUpload: false,
  builder: "other",
};

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("url" in body) ||
    typeof (body as Record<string, unknown>)["url"] !== "string"
  ) {
    return NextResponse.json(
      { error: 'Request body must be { "url": "https://..." }' },
      { status: 400 },
    );
  }

  const url = ((body as Record<string, unknown>)["url"] as string).trim();

  if (!url) {
    return NextResponse.json({ error: "url must not be empty." }, { status: 400 });
  }

  const result = await analyzeUrl(url, SCANNER_PROMPT_CTX);
  return NextResponse.json(result);
}
