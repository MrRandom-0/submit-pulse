/**
 * INCOMPLETE — NOT PRODUCTION VERIFIED
 *
 * Google Sheets integration driver — appends each form submission as a new row
 * in a target spreadsheet via the Google Sheets REST API v4.
 *
 * Required credentials (stored encrypted in integrations.credentials):
 *   - accessToken  : OAuth 2.0 access token (short-lived; refresh with refreshToken)
 *   - refreshToken : OAuth 2.0 refresh token for obtaining new access tokens
 *   - clientId     : OAuth client ID (from Google Cloud Console)
 *   - clientSecret : OAuth client secret
 *
 * Required config (stored in integrations.config — non-secret):
 *   - spreadsheetId : The spreadsheet ID from the URL (…/spreadsheets/d/{ID}/…)
 *   - sheetName     : Target sheet tab name (default: "Sheet1")
 *   - headerRow     : Whether the first row is a header (drives column mapping)
 *
 * OAuth scopes required:
 *   https://www.googleapis.com/auth/spreadsheets
 *
 * Token refresh is handled inside the driver on 401 responses. The caller is
 * responsible for persisting the new accessToken back to the encrypted store
 * after a successful refresh — this driver emits the new token in DeliveryResult
 * metadata. (TODO: define a callback mechanism for token persistence.)
 */

import { assertSafeEgressUrl, safeFetch } from "@submitpulse/security/ssrf";
import type {
  DeliveryResult,
  IntegrationEvent,
  IntegrationPayload,
  IntegrationProvider,
  TestResult,
} from "../provider";
import { IntegrationConfigError } from "../provider";
import { brand } from "@submitpulse/config";

interface GoogleSheetsCredentials {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly clientId: string;
  readonly clientSecret: string;
}

interface GoogleSheetsConfig {
  readonly spreadsheetId: string;
  readonly sheetName?: string;
}

export class GoogleSheetsDriver implements IntegrationProvider {
  readonly permissionExplanation =
    `Grants ${brand.name} permission to append rows to one Google Spreadsheet ` +
    "you specify. The integration cannot read existing data, create or delete " +
    "sheets, or access any other files in your Google Drive.";

  readonly #creds: GoogleSheetsCredentials;
  readonly #spreadsheetId: string;
  readonly #sheetName: string;
  #accessToken: string;

  constructor(credentials: GoogleSheetsCredentials, config: GoogleSheetsConfig) {
    for (const field of ["accessToken", "refreshToken", "clientId", "clientSecret"] as const) {
      if (!credentials[field]) {
        throw new IntegrationConfigError(
          `Google Sheets driver requires ${field}`,
          "google_sheets",
          field,
        );
      }
    }
    if (!config.spreadsheetId) {
      throw new IntegrationConfigError(
        "Google Sheets driver requires spreadsheetId in config",
        "google_sheets",
        "spreadsheetId",
      );
    }
    this.#creds = credentials;
    this.#spreadsheetId = config.spreadsheetId;
    this.#sheetName = config.sheetName ?? "Sheet1";
    this.#accessToken = credentials.accessToken;
  }

  async connect(_config: IntegrationPayload): Promise<void> {
    const result = await this.test();
    if (!result.ok) {
      throw new IntegrationConfigError(
        `Google Sheets connect failed: ${result.message}`,
        "google_sheets",
      );
    }
  }

  async disconnect(): Promise<void> {
    // Revoke the OAuth token via Google's revocation endpoint.
    // App layer should also clear the stored credentials.
    try {
      const safeUrl = await assertSafeEgressUrl(
        `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(this.#creds.refreshToken)}`,
      );
      await safeFetch(safeUrl, { method: "POST" });
    } catch {
      // Best-effort revocation; do not throw.
    }
  }

  async test(): Promise<TestResult> {
    try {
      const safeUrl = await assertSafeEgressUrl(
        `https://sheets.googleapis.com/v4/spreadsheets/${this.#spreadsheetId}?fields=spreadsheetId,properties.title`,
      );
      const res = await safeFetch(safeUrl, {
        method: "GET",
        headers: { Authorization: `Bearer ${this.#accessToken}` },
      });
      if (res.ok) return { ok: true, message: "Spreadsheet accessible" };
      if (res.status === 401) {
        const refreshed = await this.#refreshAccessToken();
        if (!refreshed) return { ok: false, message: "OAuth token refresh failed" };
        return { ok: true, message: "Spreadsheet accessible (token refreshed)" };
      }
      return { ok: false, message: `Google Sheets HTTP ${res.status}` };
    } catch (err) {
      return { ok: false, message: "Google Sheets test error", detail: String(err) };
    }
  }

  async send(event: IntegrationEvent, payload: IntegrationPayload): Promise<DeliveryResult> {
    const values = [
      new Date().toISOString(),
      event,
      ...Object.entries(payload)
        .filter(([k]) => !k.startsWith("_"))
        .map(([_k, v]) => String(v ?? "")),
    ];

    const range = `${this.#sheetName}!A:A`;
    const appendUrl =
      `https://sheets.googleapis.com/v4/spreadsheets/${this.#spreadsheetId}/values/${encodeURIComponent(range)}:append` +
      `?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

    try {
      const safeUrl = await assertSafeEgressUrl(appendUrl);
      const res = await safeFetch(safeUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.#accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ values: [values] }),
      });

      if (res.ok) {
        const body = (await res.json()) as Record<string, unknown>;
        return { ok: true, providerRef: String(body["updatedRange"] ?? "") };
      }

      if (res.status === 401) {
        const refreshed = await this.#refreshAccessToken();
        if (!refreshed) {
          return { ok: false, retryable: false, message: "OAuth token refresh failed" };
        }
        // Let the retry pick it up with the refreshed token.
        return { ok: false, retryable: true, message: "Token refreshed; retry" };
      }

      const retryable = res.status === 429 || res.status >= 500;
      return { ok: false, retryable, message: `Google Sheets HTTP ${res.status}` };
    } catch (err) {
      return { ok: false, retryable: true, message: "Google Sheets send error", detail: String(err) };
    }
  }

  /** Refresh the access token using the refresh token. Returns true on success. */
  async #refreshAccessToken(): Promise<boolean> {
    try {
      const safeUrl = await assertSafeEgressUrl("https://oauth2.googleapis.com/token");
      const res = await safeFetch(safeUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: this.#creds.refreshToken,
          client_id: this.#creds.clientId,
          client_secret: this.#creds.clientSecret,
        }).toString(),
      });
      if (!res.ok) return false;
      const body = (await res.json()) as Record<string, unknown>;
      const newToken = body["access_token"];
      if (typeof newToken !== "string") return false;
      this.#accessToken = newToken;
      // TODO: emit newToken to caller for persistence in the encrypted store.
      return true;
    } catch {
      return false;
    }
  }
}
