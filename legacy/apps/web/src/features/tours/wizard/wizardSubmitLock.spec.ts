import assert from "node:assert/strict";
import test from "node:test";

import { isWizardSubmitLocked } from "./wizardSubmitLock";

test("isWizardSubmitLocked: false when idle", () => {
  assert.equal(isWizardSubmitLocked({ isPending: false, isSuccess: false }), false);
});

test("isWizardSubmitLocked: true when pending", () => {
  assert.equal(isWizardSubmitLocked({ isPending: true, isSuccess: false }), true);
});

test("isWizardSubmitLocked: true when success (post-submit lock)", () => {
  assert.equal(isWizardSubmitLocked({ isPending: false, isSuccess: true }), true);
});
