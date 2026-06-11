import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { WorkspaceThemeValidationError } from "../../src/errors/workspace-validation-errors.js";
import { validateTenantTheme } from "../../src/theme/tenant-theme-validation.js";

describe("validateTenantTheme", () => {
  it("accepts safe platform variables", () => {
    const theme = validateTenantTheme({
      primaryColor: "#1e5a8e",
      cssVariables: {
        "--color-primary": "var(--color-info)",
        "color-border": " #ccc ",
      },
    });
    assert.equal(theme.primaryColor, "#1e5a8e");
    assert.deepEqual(theme.cssVariables, {
      "--color-primary": "var(--color-info)",
      "--color-border": "#ccc",
    });
  });

  it("rejects workspace-scoped keys", () => {
    assert.throws(
      () =>
        validateTenantTheme({
          cssVariables: { "--ws-color-accent": "red" },
        }),
      (error: unknown) => {
        assert.ok(error instanceof WorkspaceThemeValidationError);
        assert.equal(error.code, "INVALID_THEME_CSS_KEY");
        return true;
      },
    );
  });

  it("rejects unsafe css values", () => {
    assert.throws(
      () =>
        validateTenantTheme({
          cssVariables: { "--color-primary": "url(javascript:alert(1))" },
        }),
      (error: unknown) => {
        assert.ok(error instanceof WorkspaceThemeValidationError);
        assert.equal(error.code, "UNSAFE_THEME_CSS_VALUE");
        return true;
      },
    );
  });

  it("accepts defaultLocale fa or en", () => {
    const theme = validateTenantTheme({ defaultLocale: "en" });
    assert.equal(theme.defaultLocale, "en");
  });

  it("rejects invalid defaultLocale", () => {
    assert.throws(
      () =>
        validateTenantTheme({
          defaultLocale: "de",
        }),
      (error: unknown) => {
        assert.ok(error instanceof WorkspaceThemeValidationError);
        assert.equal(error.code, "TENANT_INVALID_SHAPE");
        return true;
      }
    );
  });

  it("rejects unsafe primaryColor", () => {
    assert.throws(
      () =>
        validateTenantTheme({
          primaryColor: "expression(alert(1))",
        }),
      (error: unknown) => {
        assert.ok(error instanceof WorkspaceThemeValidationError);
        assert.equal(error.code, "UNSAFE_THEME_CSS_VALUE");
        return true;
      },
    );
  });
});
