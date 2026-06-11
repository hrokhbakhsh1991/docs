/**
 * Phase 11.3 — draft sync indicator mapping (WEB-P11-3-03)
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveDraftSyncIndicatorView } from "../src/draft/draft-sync-indicator-logic";

describe("draft-sync-indicator-logic.spec.ts — Phase 11.3", () => {
  it("WEB-P11-3-03 SYNCING maps to info variant", () => {
    const view = resolveDraftSyncIndicatorView("SYNCING");
    assert.equal(view.variant, "info");
    assert.equal(view.visible, true);
    assert.equal(view.messageKey, "draftSync.syncing");
  });

  it("IDLE is hidden by default", () => {
    const view = resolveDraftSyncIndicatorView("IDLE");
    assert.equal(view.visible, false);
    assert.equal(view.variant, "success");
  });

  it("ERROR exposes retry affordance", () => {
    const view = resolveDraftSyncIndicatorView("ERROR");
    assert.equal(view.variant, "danger");
    assert.equal(view.showRetry, true);
  });
});
