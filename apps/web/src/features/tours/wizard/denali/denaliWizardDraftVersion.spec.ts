import assert from "node:assert/strict";
import test from "node:test";

import {
  computeDenaliWizardDraftVersionHash,
  getDenaliWizardDraftVersionHash,
  isDenaliWizardDraftVersionCompatible,
} from "./denaliWizardDraftVersion";

test("draft versionHash is stable for unchanged step config and rule set", () => {
  const a = computeDenaliWizardDraftVersionHash();
  const b = getDenaliWizardDraftVersionHash();
  assert.equal(a, b);
});

test("isDenaliWizardDraftVersionCompatible rejects missing or mismatched hash", () => {
  const current = getDenaliWizardDraftVersionHash();
  assert.equal(isDenaliWizardDraftVersionCompatible(undefined, current), false);
  assert.equal(isDenaliWizardDraftVersionCompatible("deadbeef", current), false);
  assert.equal(isDenaliWizardDraftVersionCompatible(current, current), true);
});
