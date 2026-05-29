import assert from "node:assert/strict";
import test from "node:test";

import { buildTenantThemeStyle, normalizeCssVariableName } from "./build-tenant-theme-style";

test("normalizeCssVariableName strips leading --", () => {
  assert.equal(normalizeCssVariableName("--color-primary"), "color-primary");
  assert.equal(normalizeCssVariableName("color-primary"), "color-primary");
});

test("buildTenantThemeStyle maps primaryColor to semantic tokens", () => {
  const style = buildTenantThemeStyle({ primaryColor: "#e11d48" });
  assert.equal(style["--color-primary"], "#e11d48");
  assert.equal(style["--color-primary-500"], "#e11d48");
  assert.equal(style["--color-text-link"], "#e11d48");
});

test("buildTenantThemeStyle: cssVariables override primaryColor", () => {
  const style = buildTenantThemeStyle({
    primaryColor: "#e11d48",
    cssVariables: { "color-primary": "#1e5a8e" },
  });
  assert.equal(style["--color-primary"], "#1e5a8e");
});
