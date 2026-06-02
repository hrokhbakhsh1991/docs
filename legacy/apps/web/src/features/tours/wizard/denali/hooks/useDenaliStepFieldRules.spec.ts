import assert from "node:assert/strict";
import test from "node:test";

import { resolveIsCategoryManuallySelected } from "./useDenaliStepFieldRules";

test("resolveIsCategoryManuallySelected: guard off always allows visibility checks", () => {
  assert.equal(resolveIsCategoryManuallySelected(false, null), true);
  assert.equal(resolveIsCategoryManuallySelected(false, "mountain"), true);
});

test("resolveIsCategoryManuallySelected: guard on requires user-selected category", () => {
  assert.equal(resolveIsCategoryManuallySelected(true, null), false);
  assert.equal(resolveIsCategoryManuallySelected(true, "mountain"), true);
});
