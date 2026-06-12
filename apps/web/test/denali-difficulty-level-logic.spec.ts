import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatDifficultyLevelDisplay,
  formatDifficultyLevelStorage,
  parseDifficultyLevel,
  snapDifficultyLevel,
} from "../src/wizard/denali/denali-difficulty-level-logic";

describe("denali-difficulty-level-logic.spec.ts", () => {
  it("DN-DIFF-01 snaps to half steps between 1 and 10", () => {
    assert.equal(snapDifficultyLevel(6.4), 6.5);
    assert.equal(snapDifficultyLevel(6.6), 6.5);
    assert.equal(snapDifficultyLevel(7), 7);
    assert.equal(snapDifficultyLevel(0.5), 1);
    assert.equal(snapDifficultyLevel(10.5), 10);
  });

  it("DN-DIFF-02 stores integers without trailing decimals", () => {
    assert.equal(formatDifficultyLevelStorage(7), "7");
    assert.equal(formatDifficultyLevelStorage(6.5), "6.5");
  });

  it("DN-DIFF-03 renders Persian digits for fa locale", () => {
    assert.equal(formatDifficultyLevelDisplay(6.5, "fa"), "۶.۵");
    assert.equal(formatDifficultyLevelDisplay(7, "fa"), "۷");
    assert.equal(formatDifficultyLevelDisplay(7, "en"), "7");
  });

  it("DN-DIFF-04 parses draft strings with half steps", () => {
    assert.equal(parseDifficultyLevel("6.5"), 6.5);
    assert.equal(parseDifficultyLevel(""), 5);
    assert.equal(parseDifficultyLevel("7.2"), 7);
  });
});
