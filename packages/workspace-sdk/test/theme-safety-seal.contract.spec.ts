import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { WorkspaceThemeValidationError } from "../src/errors/workspace-validation-errors.js";
import { assertWorkspaceThemeContract } from "../src/plugin/workspace-plugin-validation.js";
import {
  assertWorkspaceThemeSealed,
  sealWorkspaceTheme,
} from "../src/theme/theme-safety-seal.js";
import { snapshotWorkspaceTheme } from "../src/theme/workspace-theme-snapshot.js";

describe("theme safety seal", () => {
  it("snapshotWorkspaceTheme returns a sealed theme", () => {
    const raw = {
      id: "starter",
      version: 1,
      cssVariables: { "--ws-color-accent": "var(--color-primary)" },
    };
    assertWorkspaceThemeContract(raw);
    const sealed = snapshotWorkspaceTheme(raw);
    assert.doesNotThrow(() => assertWorkspaceThemeSealed(sealed));
  });

  it("rejects unsealed workspace theme", () => {
    const raw = {
      id: "starter",
      version: 1,
      cssVariables: { "--ws-color-accent": "var(--color-primary)" },
    };
    assertWorkspaceThemeContract(raw);
    assert.throws(() => assertWorkspaceThemeSealed(raw), (error: unknown) => {
      assert.ok(error instanceof WorkspaceThemeValidationError);
      assert.equal(error.code, "UNSEALED_THEME");
      return true;
    });
  });

  it("rejects re-sealed clone of sealed theme", () => {
    const raw = {
      id: "starter",
      version: 1,
      cssVariables: { "--ws-color-accent": "#1e5a8e" },
    };
    assertWorkspaceThemeContract(raw);
    const sealed = sealWorkspaceTheme(snapshotWorkspaceTheme(raw));
    const clone = {
      id: sealed.id,
      version: sealed.version,
      cssVariables: { ...sealed.cssVariables },
    };
    assert.throws(() => assertWorkspaceThemeSealed(clone), WorkspaceThemeValidationError);
  });
});
