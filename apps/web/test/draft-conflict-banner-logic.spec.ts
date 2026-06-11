/**
 * Phase 11.3 — conflict banner view logic (11.3-T6)
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveDraftConflictBannerView } from "../src/draft/draft-conflict-banner-logic";

describe("draft-conflict-banner-logic.spec.ts — Phase 11.3", () => {
  it("WEB-P11-3-06 CONFLICT_RESOLVING shows resolving banner", () => {
    const view = resolveDraftConflictBannerView("CONFLICT_RESOLVING", false, false);
    assert.equal(view.kind, "resolving");
  });

  it("WEB-P11-3-06 DRAFT_AVAILABLE with pending draft shows actions when handlers exist", () => {
    const view = resolveDraftConflictBannerView("DRAFT_AVAILABLE", true, true);
    assert.equal(view.kind, "available");
    if (view.kind === "available") {
      assert.equal(view.showActions, true);
    }
  });

  it("IDLE hides the banner", () => {
    const view = resolveDraftConflictBannerView("IDLE", true, true);
    assert.equal(view.kind, "hidden");
  });
});
