import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveThemeCompatibleCategories } from "../src/settings/theme-compatible-categories";

describe("theme-compatible-categories", () => {
  it("DN-THEME-CAT-01 mountain_outdoor maps to mountain", () => {
    assert.deepEqual(resolveThemeCompatibleCategories("mountain_outdoor"), ["mountain"]);
  });

  it("DN-THEME-CAT-02 unknown profile returns empty", () => {
    assert.deepEqual(resolveThemeCompatibleCategories("unknown_profile"), []);
  });
});
