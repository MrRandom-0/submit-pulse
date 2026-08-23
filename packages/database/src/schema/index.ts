/**
 * Schema barrel.
 *
 * Drizzle needs every table in one object to resolve relations and to generate
 * migrations, so this file must re-export all schema modules. Import tables
 * from here (`@submitpulse/database/schema`) rather than reaching into the
 * individual modules, so a future reorganisation stays contained.
 */

export * from "./enums";
export * from "./identity";
export * from "./forms";
export * from "./submissions";
export * from "./delivery";
export * from "./health";
export * from "./platform";
