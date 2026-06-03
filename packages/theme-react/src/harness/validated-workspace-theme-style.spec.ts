import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getStarterWorkspacePlugin, getWorkspaceThemePresets } from "@app-tour/workspace-sdk";

import { ThemeIngressGuardError } from "../ingress/theme-ingress-guard";
import { validatedWorkspacePresetStyle, validatedWorkspaceThemeStyle } from "./validated-workspace-theme-style";

describe("validatedWorkspaceThemeStyle", () => {
  it("returns style for platform-primary preset via ingress", () => {
    const style = validatedWorkspacePresetStyle("platform-primary");
    assert.ok(style);
    assert.equal(style!["--ws-color-accent"], "var(--color-primary)");
  });

  it("throws ThemeIngressGuardError for invalid workspace keys", () => {
    assert.throws(
      () =>
        validatedWorkspaceThemeStyle(getStarterWorkspacePlugin(), {
          id: "x",
          version: 1,
          cssVariables: { "--evil": "red" },
        }),
      ThemeIngressGuardError,
    );
  });

  it("returns empty style object when preset has no css variables", () => {
    const style = validatedWorkspaceThemeStyle(
      getStarterWorkspacePlugin(),
      getWorkspaceThemePresets().default,
    );
    assert.deepEqual(style, {});
  });
});
