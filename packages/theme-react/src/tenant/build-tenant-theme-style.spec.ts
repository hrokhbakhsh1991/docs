import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { validateTenantTheme, WorkspaceThemeValidationError } from "@app-tour/workspace-sdk";

import { buildTenantThemeStyle } from "./build-tenant-theme-style";

describe("buildTenantThemeStyle safety seal", () => {
  it("maps sealed tenant theme to CSS variables", () => {
    const style = buildTenantThemeStyle(
      validateTenantTheme({
        primaryColor: "#1e5a8e",
        cssVariables: { "--color-border": "#ccc" },
      }),
    ) as Record<string, string>;
    assert.equal(style["--color-primary"], "#1e5a8e");
    assert.equal(style["--color-border"], "#ccc");
  });

  it("omitPrimaryColor skips primary family from primaryColor and cssVariables (F9-4)", () => {
    const style = buildTenantThemeStyle(
      validateTenantTheme({
        primaryColor: "#0f766e",
        cssVariables: {
          "--color-primary": "#0f766e",
          "--color-primary-hover": "#0f766e",
          "--color-text-link": "#0f766e",
          "--color-border": "#ccc",
        },
      }),
      { omitPrimaryColor: true },
    ) as Record<string, string>;
    assert.equal(style["--color-primary"], undefined);
    assert.equal(style["--color-primary-hover"], undefined);
    assert.equal(style["--color-text-link"], undefined);
    assert.equal(style["--color-border"], "#ccc");
  });

  it("throws UNSEALED_THEME for plain object", () => {
    assert.throws(
      () =>
        buildTenantThemeStyle({
          primaryColor: "#1e5a8e",
        } as ReturnType<typeof validateTenantTheme>),
      (error: unknown) => {
        assert.ok(error instanceof WorkspaceThemeValidationError);
        assert.equal(error.code, "UNSEALED_THEME");
        return true;
      },
    );
  });
});
