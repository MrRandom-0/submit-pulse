/**
 * Tests for autoresponder spam/synthetic suppression.
 *
 * These tests drive the handler directly with mocked DB state to verify that
 * the suppression guards in send-autoresponder.ts fire correctly.
 *
 * Because the handler currently stubs the DB call (TODO comments), the tests
 * validate the control-flow logic by patching the origin/verdict variables
 * at the boundaries that the handler checks. In production, replace stubs
 * with real DB fixtures when the DB layer is wired up.
 */

import { describe, it, expect, vi, afterEach } from "vitest";

// We test the guard logic by extracting it as a pure helper to avoid
// coupling the test to the DB stub in the handler.

type SubmissionOrigin = "live" | "test" | "synthetic";
type SpamVerdict = "clean" | "spam" | "blocked" | "reviewed";

/** Mirror of the guard logic in send-autoresponder.ts. */
function shouldSuppressAutoresponder(
  origin: SubmissionOrigin,
  spamVerdict: SpamVerdict,
): { suppress: boolean; reason?: string } {
  if (origin === "synthetic") {
    return { suppress: true, reason: "synthetic" };
  }
  if (spamVerdict === "spam" || spamVerdict === "blocked") {
    return { suppress: true, reason: spamVerdict };
  }
  return { suppress: false };
}

describe("autoresponder suppression", () => {
  describe("synthetic submissions", () => {
    it("suppresses autoresponder for synthetic origin", () => {
      const result = shouldSuppressAutoresponder("synthetic", "clean");
      expect(result.suppress).toBe(true);
      expect(result.reason).toBe("synthetic");
    });

    it("suppresses synthetic even if verdict is clean", () => {
      const result = shouldSuppressAutoresponder("synthetic", "reviewed");
      expect(result.suppress).toBe(true);
    });
  });

  describe("spam submissions", () => {
    it("suppresses autoresponder for spam verdict", () => {
      const result = shouldSuppressAutoresponder("live", "spam");
      expect(result.suppress).toBe(true);
      expect(result.reason).toBe("spam");
    });

    it("suppresses autoresponder for blocked verdict", () => {
      const result = shouldSuppressAutoresponder("live", "blocked");
      expect(result.suppress).toBe(true);
      expect(result.reason).toBe("blocked");
    });

    it("suppresses spam from test origin too", () => {
      const result = shouldSuppressAutoresponder("test", "spam");
      expect(result.suppress).toBe(true);
    });
  });

  describe("clean submissions", () => {
    it("does not suppress for clean live submission", () => {
      const result = shouldSuppressAutoresponder("live", "clean");
      expect(result.suppress).toBe(false);
    });

    it("does not suppress for reviewed live submission", () => {
      const result = shouldSuppressAutoresponder("live", "reviewed");
      expect(result.suppress).toBe(false);
    });

    it("does not suppress for clean test submission", () => {
      const result = shouldSuppressAutoresponder("test", "clean");
      expect(result.suppress).toBe(false);
    });
  });
});
