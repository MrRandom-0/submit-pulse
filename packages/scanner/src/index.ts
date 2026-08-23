/**
 * @submitpulse/scanner — public barrel
 */

export { analyzeUrl } from "./analyze.js";
export type { ScanResult, FormInfo, FieldInfo } from "./analyze.js";

export { makeScanIssue, ISSUE_CODES } from "./issues.js";
export type { ScanIssue, Severity } from "./issues.js";

export { diffSchema, inferType } from "./drift.js";
export type { DriftResult, DriftKind, SchemaField, ObservedField } from "./drift.js";
