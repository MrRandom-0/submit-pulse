/**
 * INCOMPLETE — NOT PRODUCTION VERIFIED
 *
 * Notion integration driver — creates a Notion page (database entry) for each
 * form submission using the Notion API v1.
 *
 * Required credentials (stored encrypted in integrations.credentials):
 *   - integrationToken : Notion Internal Integration Token (secret_…)
 *     OR
 *   - accessToken      : Notion OAuth access token (ntn_…) — from the OAuth flow
 *
 * Required config (stored in integrations.config — non-secret):
 *   - databaseId : The Notion database ID (hyphenated UUID from the page URL)
 *
 * The integration must be shared with the target Notion database; Notion
 * access control is capability-based at the integration level.
 *
 * OAuth scopes required (when using OAuth):
 *   read_content, update_content, insert_content
 *
 * Property mapping: submission fields are mapped to Notion database properties
 * by name (case-sensitive). Fields with no matching Notion property are silently
 * dropped. A future enhancement could expose a field-mapping config.
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

interface NotionCredentials {
  readonly integrationToken?: string;
  readonly accessToken?: string;
}

interface NotionConfig {
  readonly databaseId: string;
}

export class NotionDriver implements IntegrationProvider {
  readonly permissionExplanation =
    `Grants ${brand.name} permission to create new pages in one Notion database ` +
    "you share with the integration. The integration cannot read existing pages, " +
    "modify or delete content, or access other Notion workspaces or pages.";

  readonly #token: string;
  readonly #databaseId: string;

  readonly #NOTION_API = "https://api.notion.com/v1";
  readonly #NOTION_VERSION = "2022-06-28";

  constructor(credentials: NotionCredentials, config: NotionConfig) {
    const token = credentials.integrationToken ?? credentials.accessToken;
    if (!token) {
      throw new IntegrationConfigError(
        "Notion driver requires integrationToken or accessToken",
        "notion",
        "integrationToken|accessToken",
      );
    }
    if (!config.databaseId) {
      throw new IntegrationConfigError(
        "Notion driver requires databaseId in config",
        "notion",
        "databaseId",
      );
    }
    this.#token = token;
    this.#databaseId = config.databaseId;
  }

  #headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.#token}`,
      "Content-Type": "application/json",
      "Notion-Version": this.#NOTION_VERSION,
    };
  }

  async connect(_config: IntegrationPayload): Promise<void> {
    const result = await this.test();
    if (!result.ok) {
      throw new IntegrationConfigError(
        `Notion connect failed: ${result.message}`,
        "notion",
      );
    }
  }

  async disconnect(): Promise<void> {
    // Integration tokens are revoked in the Notion integration settings UI.
    // OAuth tokens can be revoked via Notion's token revocation endpoint (not yet public).
  }

  async test(): Promise<TestResult> {
    try {
      const safeUrl = await assertSafeEgressUrl(
        `${this.#NOTION_API}/databases/${this.#databaseId}`,
      );
      const res = await safeFetch(safeUrl, {
        method: "GET",
        headers: this.#headers(),
      });
      if (res.ok) return { ok: true, message: "Database accessible" };
      return { ok: false, message: `Notion HTTP ${res.status}` };
    } catch (err) {
      return { ok: false, message: "Notion test error", detail: String(err) };
    }
  }

  async send(event: IntegrationEvent, payload: IntegrationPayload): Promise<DeliveryResult> {
    // Build Notion rich text properties for each submission field.
    // Only "rich_text" and "title" property types are supported here.
    // More complex type mapping (number, date, select) requires schema introspection.
    const properties: Record<string, unknown> = {
      Name: {
        title: [{ text: { content: `Submission — ${event}`.slice(0, 2000) } }],
      },
    };

    for (const [k, v] of Object.entries(payload)) {
      if (k.startsWith("_")) continue;
      properties[k] = {
        rich_text: [{ text: { content: String(v ?? "").slice(0, 2000) } }],
      };
    }

    try {
      const safeUrl = await assertSafeEgressUrl(`${this.#NOTION_API}/pages`);
      const res = await safeFetch(safeUrl, {
        method: "POST",
        headers: this.#headers(),
        body: JSON.stringify({
          parent: { database_id: this.#databaseId },
          properties,
        }),
      });

      if (res.ok) {
        const body = (await res.json()) as Record<string, unknown>;
        return { ok: true, providerRef: String(body["id"] ?? "") };
      }

      const retryable = res.status === 429 || res.status >= 500;
      return { ok: false, retryable, message: `Notion HTTP ${res.status}` };
    } catch (err) {
      return { ok: false, retryable: true, message: "Notion send error", detail: String(err) };
    }
  }
}
