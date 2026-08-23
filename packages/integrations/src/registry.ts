/**
 * Integration registry — maps integrationProviderEnum values to their driver
 * classes and metadata. The UI imports this to enumerate available integrations.
 *
 * NOTE: This module imports driver constructors only; it does NOT instantiate
 * drivers. Instantiation happens in the delivery worker after retrieving and
 * decrypting credentials from the database.
 */

import { AirtableDriver } from "./drivers/airtable";
import { DiscordDriver } from "./drivers/discord";
import { GenericWebhookDriver } from "./drivers/generic-webhook";
import { GoogleSheetsDriver } from "./drivers/google-sheets";
import { MakeDriver } from "./drivers/make";
import { NotionDriver } from "./drivers/notion";
import { SlackDriver } from "./drivers/slack";
import { TelegramDriver } from "./drivers/telegram";
import { ZapierDriver } from "./drivers/zapier";
import { brand } from "@submitpulse/config";

/** The string literal union matching integrationProviderEnum in the database. */
export type IntegrationProviderKey =
  | "slack"
  | "discord"
  | "telegram"
  | "google_sheets"
  | "airtable"
  | "notion"
  | "zapier"
  | "make"
  | "generic_webhook";

export interface RegistryEntry {
  /** Display name shown in the integrations UI. */
  readonly displayName: string;
  /** One-line description of what the integration does. */
  readonly description: string;
  /** Whether the integration uses OAuth for authentication. */
  readonly usesOAuth: boolean;
  /**
   * The driver constructor. The actual constructor signature varies by driver;
   * use the specific import when instantiating. This entry is typed broadly so
   * the registry can be iterated without knowing specific shapes.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly driverClass: new (...args: any[]) => unknown;
  /** URL to the provider's developer documentation. */
  readonly docsUrl: string;
}

export const INTEGRATION_REGISTRY: Readonly<Record<IntegrationProviderKey, RegistryEntry>> = {
  slack: {
    displayName: "Slack",
    description: "Post new submissions as messages to a Slack channel.",
    usesOAuth: true,
    driverClass: SlackDriver,
    docsUrl: "https://api.slack.com/messaging/webhooks",
  },
  discord: {
    displayName: "Discord",
    description: "Post new submissions as messages to a Discord channel.",
    usesOAuth: false,
    driverClass: DiscordDriver,
    docsUrl: "https://discord.com/developers/docs/resources/webhook",
  },
  telegram: {
    displayName: "Telegram",
    description: "Send new submissions as Telegram bot messages.",
    usesOAuth: false,
    driverClass: TelegramDriver,
    docsUrl: "https://core.telegram.org/bots/api#sendmessage",
  },
  google_sheets: {
    displayName: "Google Sheets",
    description: "Append each submission as a new row in a Google Spreadsheet.",
    usesOAuth: true,
    driverClass: GoogleSheetsDriver,
    docsUrl: "https://developers.google.com/sheets/api",
  },
  airtable: {
    displayName: "Airtable",
    description: "Create a new record in an Airtable table for each submission.",
    usesOAuth: false,
    driverClass: AirtableDriver,
    docsUrl: "https://airtable.com/developers/web/api/introduction",
  },
  notion: {
    displayName: "Notion",
    description: "Create a Notion page in a database for each submission.",
    usesOAuth: true,
    driverClass: NotionDriver,
    docsUrl: "https://developers.notion.com/docs/getting-started",
  },
  zapier: {
    displayName: "Zapier",
    description: "Trigger Zapier automations via a Catch Hook webhook URL.",
    usesOAuth: false,
    driverClass: ZapierDriver,
    docsUrl: "https://zapier.com/apps/webhook/integrations",
  },
  make: {
    displayName: "Make",
    description: "Trigger Make scenarios via a Custom Webhook.",
    usesOAuth: false,
    driverClass: MakeDriver,
    docsUrl: "https://www.make.com/en/help/tools/webhooks",
  },
  generic_webhook: {
    displayName: "Webhook",
    description: "POST submission data as JSON to any HTTPS endpoint you control.",
    usesOAuth: false,
    driverClass: GenericWebhookDriver,
    docsUrl: `${brand.domains.marketing}/docs/integrations/webhook`,
  },
} as const;

/** Ordered list of provider keys for UI enumeration. */
export const ORDERED_PROVIDERS: readonly IntegrationProviderKey[] = [
  "slack",
  "discord",
  "telegram",
  "google_sheets",
  "airtable",
  "notion",
  "zapier",
  "make",
  "generic_webhook",
] as const;
