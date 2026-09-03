import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { mergeTenantConfigSurfaceTheme } from "./merge-tenant-config-surface-theme";

describe("merge-tenant-config-surface-theme", () => {
  it("copies enabledModules, portalModuleGrants, and commerce from raw theme", () => {
    const merged = mergeTenantConfigSurfaceTheme(
      { primaryColor: "#059669", defaultLocale: "fa" },
      {
        enabledModules: ["wallet"],
        portalModuleGrants: ["wallet"],
        commerce: { currency: "IRR", paymentMode: "offline_receipt" },
      }
    );

    assert.deepEqual((merged as { enabledModules?: string[] }).enabledModules, ["wallet"]);
    assert.deepEqual((merged as { portalModuleGrants?: string[] }).portalModuleGrants, ["wallet"]);
    assert.equal((merged as { commerce?: { currency?: string } }).commerce?.currency, "IRR");
    assert.equal(merged.primaryColor, "#059669");
  });

  it("returns branding theme unchanged when raw theme has no capability fields", () => {
    const branding = { primaryColor: "#2563eb" };
    assert.deepEqual(mergeTenantConfigSurfaceTheme(branding, {}), branding);
    assert.deepEqual(mergeTenantConfigSurfaceTheme(branding, null), branding);
  });
});
