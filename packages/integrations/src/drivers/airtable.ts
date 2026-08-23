/**
 * INCOMPLETE — NOT PRODUCTION VERIFIED
 *
 * Airtable integration driver — creates a record in an Airtable table for each
 * form submission, using the Airtable REST API v0.
 *
 * Required credentials (stored encrypted in integrations.credentials):
 *   - apiKey      : Airtable Personal Access Token (pat…) — preferred over legacy API keys.
 *                   Legacy API keys (key…) are deprecated by Airtable as of Feb 2024.
 *
 * Required config (stored in integrations.config — non-secret):
 *   - baseId      : Airtable Base ID (app…)
 *   - tableIdOrName : Table ID (tbl…) or table name string
 *
 * OAuth scopes (if using OAuth instead of PAT):
 *   data.records:write, data.records:read, schema.bases:read
 *
 * Airtable does not provide native idempotency keys for record creation.
 * To avoid duplicates on retry, the caller should check for an existing record
 * keyed on a submission-specific unique field (e.g. submission ID stored in a
 * hidden field) before calling send().
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

interface AirtableCredentials {
  readonly apiKey: string;
}

interface AirtableConfig {
  readonly baseId: string;
  readonly tableIdOrName: string;
}

export class AirtableDriver implements IntegrationProvider {
  readonly permissionExplanation =
    `Grants ${brand.name} permission to create new records in one Airtable table ` +
    "you specify. The integration cannot modify existing records, access other " +
    "tables, or read any data from your Airtable bases.";

  readonly #apiKey: string;
  readonly #baseId: string;
  readonly #tableIdOrName: string;

  constructor(credentials: AirtableCredentials, config: AirtableConfig) {
    if (!credentials.apiKey) {
      throw new IntegrationConfigError("Airtable driver requires apiKey", "airtable", "apiKey");
    }
    if (!config.baseId) {
      throw new IntegrationConfigError(
        "Airtable driver requires baseId in config",
        "airtable",
        "baseId",
      );
    }
    if (!config.tableIdOrName) {
      throw new IntegrationConfigError(
        "Airtable driver requires tableIdOrName in config",
        "airtable",
        "tableIdOrName",
      );
    }
    this.#apiKey = credentials.apiKey;
    this.#baseId = config.baseId;
    this.#tableIdOrName = config.tableIdOrName;
  }

  #recordsUrl(): string {
    return `https://api.airtable.com/v0/${this.#baseId}/${encodeURIComponent(this.#tableIdOrName)}`;
  }

  async connect(_config: IntegrationPayload): Promise<void> {
    const result = await this.test();
    if (!result.ok) {
      throw new IntegrationConfigError(
        `Airtable connect failed: ${result.message}`,
        "airtable",
      );
    }
  }

  async disconnect(): Promise<void> {
    // PAT revocation must be performed via the Airtable UI or account settings.
  }

  async test(): Promise<TestResult> {
    try {
      // List up to 1 record to verify access without mutating data.
      const safeUrl = await assertSafeEgressUrl(`${this.#recordsUrl()}?maxRecords=1`);
      const res = await safeFetch(safeUrl, {
        method: "GET",
        headers: { Authorization: `Bearer ${this.#apiKey}` },
      });
      if (res.ok) return { ok: true, message: "Table accessible" };
      return { ok: false, message: `Airtable HTTP ${res.status}` };
    } catch (err) {
      return { ok: false, message: "Airtable test error", detail: String(err) };
    }
  }

  async send(_event: IntegrationEvent, payload: IntegrationPayload): Promise<DeliveryResult> {
    const fields: Record<string, string> = {};
    for (const [k, v] of Object.entries(payload)) {
      if (!k.startsWith("_")) {
        fields[k] = String(v ?? "");
      }
    }

    try {
      const safeUrl = await assertSafeEgressUrl(this.#recordsUrl());
      const res = await safeFetch(safeUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.#apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ records: [{ fields }] }),
      });

      if (res.ok) {
        const body = (await res.json()) as { records?: Array<{ id: string }> };
        const recordId = body.records?.[0]?.id;
        return { ok: true, providerRef: recordId ?? "" };
      }

      const retryable = res.status === 429 || res.status >= 500;
      return { ok: false, retryable, message: `Airtable HTTP ${res.status}` };
    } catch (err) {
      return { ok: false, retryable: true, message: "Airtable send error", detail: String(err) };
    }
  }
}
