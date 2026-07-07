/**
 * Phase 3 — visibility lifecycle → flush / keepalive mapping (WEB-P11-3-10)
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveVisibilityFlushAction } from "../src/draft/draft-visibility-flush-logic";

describe("draft-visibility-flush-logic.spec.ts — Phase 3", () => {
  it("WEB-P11-3-10 visibility hidden + DIRTY triggers flush", () => {
    assert.equal(
      resolveVisibilityFlushAction("DIRTY", "visibilitychange", "hidden"),
      "flush"
    );
  });

  it("visibility hidden + IDLE is no-op", () => {
    assert.equal(
      resolveVisibilityFlushAction("IDLE", "visibilitychange", "hidden"),
      "none"
    );
  });

  it("pagehide + DIRTY triggers keepalive", () => {
    assert.equal(resolveVisibilityFlushAction("DIRTY", "pagehide", "hidden"), "keepalive");
  });

  it("pagehide + SYNCING is no-op", () => {
    assert.equal(resolveVisibilityFlushAction("SYNCING", "pagehide", "hidden"), "none");
  });

  it("CONFLICT_RESOLVING skips all flush actions", () => {
    assert.equal(
      resolveVisibilityFlushAction("CONFLICT_RESOLVING", "visibilitychange", "hidden"),
      "none"
    );
    assert.equal(
      resolveVisibilityFlushAction("CONFLICT_RESOLVING", "pagehide", "hidden"),
      "none"
    );
  });

  it("QUARANTINED skips all flush actions (Phase 5A)", () => {
    assert.equal(
      resolveVisibilityFlushAction("QUARANTINED", "visibilitychange", "hidden"),
      "none"
    );
    assert.equal(resolveVisibilityFlushAction("QUARANTINED", "pagehide", "hidden"), "none");
  });
});
