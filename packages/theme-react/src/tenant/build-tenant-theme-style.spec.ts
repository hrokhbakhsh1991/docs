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
