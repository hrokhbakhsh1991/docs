import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { assertWorkspaceThemeContract } from "../../src/plugin/workspace-plugin-theme-validation.js";
import { WorkspaceThemeValidationError } from "../../src/errors/workspace-validation-errors.js";
import { createHarnessTheme } from "../lib/immutable-harness.js";

describe("invariant: theme-ingress", () => {
  it("accepts valid --ws-* theme variables", () => {
    assert.doesNotThrow(() =>
      assertWorkspaceThemeContract({
        id: "harness-theme",
        version: 1,
        cssVariables: {
          "--ws-color-accent": "#1e5a8e",
        },
      }),
    );
  });

  it("rejects invalid theme id characters", () => {
    assert.throws(
      () =>
        assertWorkspaceThemeContract({
          id: "bad_id",
          version: 1,
          cssVariables: { "--ws-color-accent": "#000" },
        }),
      (error: unknown) => {
        assert.ok(error instanceof WorkspaceThemeValidationError);
        assert.equal(error.code, "INVALID_THEME_ID");
        return true;
      },
    );
  });

  it("rejects unsafe css values", () => {
    assert.throws(
      () =>
        assertWorkspaceThemeContract({
          ...createHarnessTheme(),
          cssVariables: { "--ws-color-accent": "javascript:alert(1)" },
        }),
      (error: unknown) => {
        assert.ok(error instanceof WorkspaceThemeValidationError);
        assert.equal(error.code, "UNSAFE_THEME_CSS_VALUE");
        return true;
      },
    );
  });
});
