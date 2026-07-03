import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  resolveSmokeCustomApexHost,
  WRS_SMOKE_DENALI_TENANT_ID,
} from "../src/platform/resolve-smoke-custom-apex-host.ts";
import { resolveTenantFromCustomDomainHost } from "../src/platform/resolve-tenant-from-custom-domain.ts";

describe("resolve-smoke-custom-apex-host", () => {
  it("WRS-SMOKE-01 disabled without WRS_SMOKE_CUSTOM_APEX", () => {
    const prior = process.env.WRS_SMOKE_CUSTOM_APEX;
    delete process.env.WRS_SMOKE_CUSTOM_APEX;
    try {
      assert.equal(resolveSmokeCustomApexHost("portal.denali.club"), null);
    } finally {
      if (prior === undefined) delete process.env.WRS_SMOKE_CUSTOM_APEX;
      else process.env.WRS_SMOKE_CUSTOM_APEX = prior;
    }
  });

  it("WRS-SMOKE-02 maps portal.denali.club to denali tenant", () => {
    const prior = process.env.WRS_SMOKE_CUSTOM_APEX;
    process.env.WRS_SMOKE_CUSTOM_APEX = "1";
    try {
      const resolved = resolveSmokeCustomApexHost("portal.denali.club:3003");
      assert.equal(resolved?.tenantId, WRS_SMOKE_DENALI_TENANT_ID);
      assert.equal(resolved?.surface, "portal");
    } finally {
      if (prior === undefined) delete process.env.WRS_SMOKE_CUSTOM_APEX;
      else process.env.WRS_SMOKE_CUSTOM_APEX = prior;
    }
  });

  it("WRS-SMOKE-03 admin.denali.club dev ingress (H-P6-03 seed path)", () => {
    const prior = process.env.WRS_SMOKE_CUSTOM_APEX;
    process.env.WRS_SMOKE_CUSTOM_APEX = "1";
    try {
      const resolved = resolveSmokeCustomApexHost("admin.denali.club");
      assert.equal(resolved?.tenantId, WRS_SMOKE_DENALI_TENANT_ID);
      assert.equal(resolved?.surface, "admin");
    } finally {
      if (prior === undefined) delete process.env.WRS_SMOKE_CUSTOM_APEX;
      else process.env.WRS_SMOKE_CUSTOM_APEX = prior;
    }
  });

  it("WRS-SMOKE-04 resolveTenantFromCustomDomainHost prefers smoke map", async () => {
    const prior = process.env.WRS_SMOKE_CUSTOM_APEX;
    process.env.WRS_SMOKE_CUSTOM_APEX = "1";
    try {
      const resolved = await resolveTenantFromCustomDomainHost("denali.club");
      assert.equal(resolved?.tenantId, WRS_SMOKE_DENALI_TENANT_ID);
      assert.equal(resolved?.subdomain, "denali");
    } finally {
      if (prior === undefined) delete process.env.WRS_SMOKE_CUSTOM_APEX;
      else process.env.WRS_SMOKE_CUSTOM_APEX = prior;
    }
  });
});
