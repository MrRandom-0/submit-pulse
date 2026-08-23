/**
 * @submitpulse/testing — shared test utilities
 *
 * All exports are pure functions / interfaces. No side effects on import.
 */

export {
  makeWorkspace,
  makeUser,
  makeForm,
  makeSubmission,
} from "./fixtures.js";

export type {
  WorkspaceFixture,
  WorkspaceFixtureOverrides,
  UserFixture,
  UserFixtureOverrides,
  FormFixture,
  FormFixtureOverrides,
  SubmissionFixture,
  SubmissionFixtureOverrides,
} from "./fixtures.js";

export { makeActor } from "./actor.js";
export type { MakeActorOptions } from "./actor.js";

export { seededRandom, pickRandom, shuffle } from "./random.js";

export {
  TenantIsolationNotImplementedError,
} from "./tenant-isolation.js";

export type {
  TenantContext,
  TenantIsolationHarness,
} from "./tenant-isolation.js";
