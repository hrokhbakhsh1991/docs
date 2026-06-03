import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertWorkspaceThemeContract,
  snapshotWorkspaceTheme,
  getStarterWorkspacePlugin,

  WorkspaceThemeValidationError,
  getWorkspaceThemePresets,

} from "@app-tour/workspace-sdk";

import { validatedWorkspaceThemeStyle } from "../harness/validated-workspace-theme-style";

/** @internal — package tests only; apps must use {@link validatedWorkspaceThemeStyle} or providers. */
import { workspaceThemeToStyle } from "./normalize-workspace-theme-style";

describe("workspaceThemeToStyle", () => {
  it("normalizes bare keys with shared normalizeThemeCssKey before DOM style", () => {
    const raw = {
      id: "test",
      version: 1,
      cssVariables: {
        "ws-color-accent": "var(--color-primary)",
      },
    };
    assertWorkspaceThemeContract(raw);
    const style = workspaceThemeToStyle(snapshotWorkspaceTheme(raw));
    assert.equal(style["--ws-color-accent"], "var(--color-primary)");
    assert.equal(Object.keys(style).length, 1);
  });

  it("matches preset keys after normalization", () => {
    const preset = getWorkspaceThemePresets()["platform-primary"];
    const raw = {
      ...preset,
      cssVariables: {
        "ws-color-accent": "var(--color-primary)",
      },
    };
    assertWorkspaceThemeContract(raw);
    const style = workspaceThemeToStyle(snapshotWorkspaceTheme(raw));
    assert.equal(style["--ws-color-accent"], "var(--color-primary)");
  });

  it("throws UNSEALED_THEME for unvalidated workspace theme", () => {
    const raw = {
      id: "test",
      version: 1,
      cssVariables: { "--ws-color-accent": "var(--color-primary)" },
    };
    assertWorkspaceThemeContract(raw);
    assert.throws(
      () => workspaceThemeToStyle(raw as Parameters<typeof workspaceThemeToStyle>[0]),
      (error: unknown) => {
        assert.ok(error instanceof WorkspaceThemeValidationError);
        assert.equal(error.code, "UNSEALED_THEME");
        return true;
      },
    );
  });
});

describe("validatedWorkspaceThemeStyle (preferred harness)", () => {
  it("rejects invalid css key through ingress", () => {
    assert.throws(() =>
      validatedWorkspaceThemeStyle(getStarterWorkspacePlugin(), {
        id: "bad",
        version: 1,
        cssVariables: { "--color-primary": "red" },
      }),
    );
  });

  it("rejects unsafe values through ingress", () => {
    assert.throws(() =>
      validatedWorkspaceThemeStyle(getStarterWorkspacePlugin(), {
        id: "bad",
        version: 1,
        cssVariables: { "--ws-color-accent": "javascript:alert(1)" },
      }),
    );
  });
});
