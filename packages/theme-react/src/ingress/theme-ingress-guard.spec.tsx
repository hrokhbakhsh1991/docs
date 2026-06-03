import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getStarterWorkspacePlugin, getWorkspaceThemePresets } from "@app-tour/workspace-sdk";

import {
  applyWorkspaceThemeUpdate,
  ThemeIngressGuardError,
  validateWorkspaceThemeIngress,
} from "./theme-ingress-guard";

describe("theme ingress guard", () => {
  it("accepts valid workspace theme", () => {
    const preset = getWorkspaceThemePresets()["platform-primary"];
    const next = validateWorkspaceThemeIngress(getStarterWorkspacePlugin(), preset);
    assert.equal(next.theme?.id, preset.id);
  });

  it("rejects invalid css key", () => {
    assert.throws(
      () =>
        validateWorkspaceThemeIngress(getStarterWorkspacePlugin(), {
          id: "starter",
          version: 1,
          cssVariables: { "--color-primary": "var(--color-primary)" },
        }),
      (error: unknown) => {
        assert.ok(error instanceof ThemeIngressGuardError);
        return true;
      },
    );
  });

  it("rejects unsafe css value", () => {
    assert.throws(
      () =>
        applyWorkspaceThemeUpdate(getStarterWorkspacePlugin(), {
          id: "starter",
          version: 1,
          cssVariables: { "--ws-color-accent": "expression(alert(1))" },
        }),
      ThemeIngressGuardError,
    );
  });

  it("allows plugin without theme", () => {
    const next = validateWorkspaceThemeIngress(getStarterWorkspacePlugin(), undefined);
    assert.equal(next.theme, undefined);
  });

  it("returns immutable theme snapshot after ingress (post-validation mutation)", () => {
    const theme = {
      id: "starter",
      version: 1,
      cssVariables: { "--ws-color-accent": "#1e5a8e" },
    };
    const guarded = validateWorkspaceThemeIngress(getStarterWorkspacePlugin(), theme);
    theme.cssVariables["--ws-color-accent"] = "javascript:alert(1)";
    assert.equal(guarded.theme?.cssVariables["--ws-color-accent"], "#1e5a8e");
    assert.notEqual(guarded.theme, theme);
  });
});
