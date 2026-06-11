/**
 * Operator theme persistence helper.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  OPERATOR_THEME_STORAGE_KEY,
  readInitialOperatorThemeDark,
} from "../src/admin/shell/operator-theme-mode";

describe("operator-theme-mode.spec.ts", () => {
  it("exports stable storage key", () => {
    assert.equal(OPERATOR_THEME_STORAGE_KEY, "operator-theme-mode");
  });

  it("readInitialOperatorThemeDark returns false without window", () => {
    assert.equal(readInitialOperatorThemeDark(), false);
  });
});
