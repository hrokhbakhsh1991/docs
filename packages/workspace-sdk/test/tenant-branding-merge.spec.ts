import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isTenantBrandingEmpty,
  resolveEffectiveTenantBranding,
} from "../src/theme/tenant-branding-merge";

describe("tenant-branding-merge", () => {
  it("resolveEffectiveTenantBranding inherits fallback when stored theme is empty", () => {
    const fallback = { primaryColor: "#059669", cssVariables: { "--color-primary": "#059669" } };
    const theme = resolveEffectiveTenantBranding({}, fallback);
    assert.equal(theme.primaryColor, "#059669");
  });

  it("resolveEffectiveTenantBranding preserves tenant override", () => {
    const stored = { primaryColor: "#ff00ff", cssVariables: { "--color-primary": "#ff00ff" } };
    const theme = resolveEffectiveTenantBranding(stored, { primaryColor: "#059669" });
    assert.equal(theme.primaryColor, "#ff00ff");
  });

  it("resolveEffectiveTenantBranding inherits defaultLocale from fallback when stored lacks it", () => {
    const stored = { primaryColor: "#0d9488", cssVariables: { "--color-primary": "#0d9488" } };
    const fallback = { defaultLocale: "en" as const };
    const theme = resolveEffectiveTenantBranding(stored, fallback);
    assert.equal(theme.primaryColor, "#0d9488");
    assert.equal(theme.defaultLocale, "en");
  });

  it("isTenantBrandingEmpty treats blank primary and css as empty", () => {
    assert.equal(isTenantBrandingEmpty({}), true);
    assert.equal(isTenantBrandingEmpty({ primaryColor: "  " }), true);
    assert.equal(isTenantBrandingEmpty({ primaryColor: "#059669" }), false);
  });
});
