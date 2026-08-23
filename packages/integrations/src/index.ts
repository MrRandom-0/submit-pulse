/**
 * @submitpulse/integrations — third-party integration drivers.
 *
 * All production paths are marked INCOMPLETE — NOT PRODUCTION VERIFIED.
 * See individual driver files for credential requirements and caveats.
 */

export type {
  DeliveryResult,
  IntegrationEvent,
  IntegrationPayload,
  IntegrationProvider,
  TestResult,
} from "./provider";
export { IntegrationConfigError, IntegrationPermanentError } from "./provider";

export { AirtableDriver } from "./drivers/airtable";
export { DiscordDriver } from "./drivers/discord";
export { GenericWebhookDriver } from "./drivers/generic-webhook";
export { GoogleSheetsDriver } from "./drivers/google-sheets";
export { MakeDriver } from "./drivers/make";
export { NotionDriver } from "./drivers/notion";
export { SlackDriver } from "./drivers/slack";
export { TelegramDriver } from "./drivers/telegram";
export { ZapierDriver } from "./drivers/zapier";

export type { IntegrationProviderKey, RegistryEntry } from "./registry";
export { INTEGRATION_REGISTRY, ORDERED_PROVIDERS } from "./registry";
