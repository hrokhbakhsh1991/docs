import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveDefaultTenantBranding } from "../src/tenant/workspace-default-tenant-branding";

describe("workspace-default-tenant-branding.spec.ts", () => {
  it("resolveDefaultTenantBranding returns emerald for workspace_type denali", () => {
    const theme = resolveDefaultTenantBranding("denali");
    assert.equal(theme.primaryColor, "#059669");
    assert.equal(theme.cssVariables?.["--color-primary"], "#059669");
  });

  it("GL-BRAND-02 denali workspace-type default has no club displayName", () => {
    const theme = resolveDefaultTenantBranding("denali");
    assert.equal(theme.displayName, undefined);
  });

  it("keeps non-Denali and unknown workspace defaults isolated", () => {
    const urban = resolveDefaultTenantBranding("urban");
    assert.equal(urban.primaryColor, "#0d9488");
    assert.notEqual(urban.primaryColor, "#059669");
    assert.deepEqual(resolveDefaultTenantBranding("future-workspace"), {});
  });
});
