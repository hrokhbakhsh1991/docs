import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveDefaultTenantBranding } from "../src/tenant/workspace-default-tenant-branding";

describe("workspace-default-tenant-branding.spec.ts", () => {
  it("resolveDefaultTenantBranding returns emerald for workspace_type denali", () => {
    const theme = resolveDefaultTenantBranding("denali");
    assert.equal(theme.primaryColor, "#0f766e");
    assert.equal(theme.cssVariables?.["--color-primary"], "#0f766e");
  });
});
