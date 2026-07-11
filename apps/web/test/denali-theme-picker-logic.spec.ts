import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  themeDisplayInitials,
  themeSwatchToneClass,
  themeSwatchToneIndex,
} from "@app-tour/workspace-denali/host/ui/logic/denali-theme-picker-logic";

describe("denali-theme-picker-logic.spec.ts", () => {
  it("DN-THEME-PICKER-01 derives initials from theme name", () => {
    assert.equal(themeDisplayInitials(""), "?");
    assert.equal(themeDisplayInitials("کوهستان"), "کو");
    assert.equal(themeDisplayInitials("Mountain Hiking"), "MH");
  });

  it("DN-THEME-PICKER-02 maps slug to stable swatch tone", () => {
    const tone = themeSwatchToneIndex("mountain-day");
    assert.ok(tone >= 0 && tone < 6);
    assert.equal(themeSwatchToneIndex("mountain-day"), tone);
    assert.match(themeSwatchToneClass("mountain-day"), /^denali-theme-picker__swatch--tone-\d$/);
  });
});
