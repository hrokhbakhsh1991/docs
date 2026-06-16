/**
 * Phase 2 — draft manual sync button mapping (WEB-P11-3-08)
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveDraftManualSyncButtonView } from "../src/draft/draft-manual-sync-button-logic";

describe("draft-manual-sync-button-logic.spec.ts — Phase 2", () => {
  it("WEB-P11-3-08 ERROR routes to retry action", () => {
    const view = resolveDraftManualSyncButtonView("ERROR");
    assert.equal(view.action, "retry");
    assert.equal(view.labelKey, "draftSync.retry");
    assert.equal(view.disabled, false);
  });

  it("DIRTY routes to flush action", () => {
    const view = resolveDraftManualSyncButtonView("DIRTY");
    assert.equal(view.action, "flush");
    assert.equal(view.labelKey, "saveDraft");
    assert.equal(view.disabled, false);
  });

  it("IDLE disables manual sync", () => {
    const view = resolveDraftManualSyncButtonView("IDLE");
    assert.equal(view.action, "none");
    assert.equal(view.disabled, true);
  });

  it("SYNCING shows saving label and disables", () => {
    const view = resolveDraftManualSyncButtonView("SYNCING");
    assert.equal(view.action, "none");
    assert.equal(view.labelKey, "savingDraft");
    assert.equal(view.disabled, true);
  });
});
