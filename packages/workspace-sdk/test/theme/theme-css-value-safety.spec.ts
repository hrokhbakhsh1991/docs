import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { WorkspaceThemeValidationError } from "../../src/errors/workspace-validation-errors.js";
import { assertThemeCssValueIsSafe } from "../../src/theme/theme-css-value-safety.js";

/** Fullwidth Latin capital J (U+FF2A) — NFKC-normalizes to ASCII `J`. */
const HOMOGLYPH_JAVASCRIPT = "\uFF2Aavascript:alert(1)";

function expectUnsafe(value: string): void {
  assert.throws(
    () => assertThemeCssValueIsSafe("--ws-color-accent", value),
    (error: unknown) => {
      assert.ok(error instanceof WorkspaceThemeValidationError);
      assert.equal(error.code, "UNSAFE_THEME_CSS_VALUE");
      return true;
    },
  );
}

describe("assertThemeCssValueIsSafe", () => {
  it("rejects homoglyph javascript after NFKC (T-6i)", () => {
    expectUnsafe(HOMOGLYPH_JAVASCRIPT);
  });

  it("rejects CSS \\u escapes (T-6j)", () => {
    expectUnsafe("\\6aavascript:alert(1)");
  });

  it("rejects CSS \\x escapes (T-6j-b)", () => {
    expectUnsafe("\\78avascript:alert(1)");
  });

  it("rejects bare backslash escapes (T-6j-c)", () => {
    expectUnsafe("java\\script:alert(1)");
  });

  it("accepts safe var() after NFKC normalization", () => {
    assert.doesNotThrow(() =>
      assertThemeCssValueIsSafe("--ws-color-accent", "  var(--color-primary)  "),
    );
  });
});
