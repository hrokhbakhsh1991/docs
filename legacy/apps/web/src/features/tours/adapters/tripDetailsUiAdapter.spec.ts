import assert from "node:assert/strict";
import test from "node:test";

import {
  formatDifficultyRatingForUi,
  selectDerivedDurationDays,
} from "./tripDetailsUiAdapter";

test("selectDerivedDurationDays delegates to domain duration helper", () => {
  assert.equal(selectDerivedDurationDays("2026-06-01", "2026-06-03"), 3);
  assert.equal(selectDerivedDurationDays(undefined, undefined), undefined);
});

test("formatDifficultyRatingForUi formats numeric ratings", () => {
  assert.equal(typeof formatDifficultyRatingForUi(2), "string");
});
