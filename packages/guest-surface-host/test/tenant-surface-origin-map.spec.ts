import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  lookupTenantSurfaceBindingForHost,
  resolveTenantSurfaceBindingForHost,
  resolveTenantSurfaceOriginFromHost,
  validateTenantSurfaceOriginMap,
} from "../src/tenant-surface-origin-map";

const map = () => ({
  version: 1,
  tenants: [
    {
      tenantId: "00000000-0000-4000-8000-000000000003",
      origins: {
        marketing: "https://denali.staging.test",
        admin: "https://admin.denali.staging.test",
        portal: "https://portal.denali.staging.test",
      },
      cookieDomain: "denali.staging.test",
      aliases: {
        admin: [
          { origin: "https://staging-admin-denali.shenski.com", cookieDomain: "shenski.com" },
        ],
        marketing: [{ origin: "https://staging-denali.shenski.com", cookieDomain: "shenski.com" }],
        portal: [
          { origin: "https://staging-portal-denali.shenski.com", cookieDomain: "shenski.com" },
        ],
      },
    },
    {
      tenantId: "f0ed9e65-2638-4351-847d-724f87ebbfce",
      origins: {
        marketing: "https://qa2.staging.test",
        admin: "https://admin.qa2.staging.test",
        portal: "https://portal.qa2.staging.test",
      },
      cookieDomain: "qa2.staging.test",
    },
  ],
});

const previousMap = process.env.TENANT_SURFACE_ORIGIN_MAP_JSON;
afterEach(() => {
  if (previousMap === undefined) delete process.env.TENANT_SURFACE_ORIGIN_MAP_JSON;
  else process.env.TENANT_SURFACE_ORIGIN_MAP_JSON = previousMap;
});

describe("tenant surface origin map", () => {
  it("resolves cross-surface egress from the matching tenant ingress host", () => {
    process.env.TENANT_SURFACE_ORIGIN_MAP_JSON = JSON.stringify(map());

    assert.equal(
      resolveTenantSurfaceOriginFromHost("portal.qa2.staging.test", "marketing"),
      "https://qa2.staging.test"
    );
    assert.equal(
      resolveTenantSurfaceOriginFromHost("admin.denali.staging.test", "portal"),
      "https://portal.denali.staging.test"
    );
    assert.equal(
      resolveTenantSurfaceBindingForHost("portal.qa2.staging.test")?.tenantId,
      "f0ed9e65-2638-4351-847d-724f87ebbfce"
    );
    assert.equal(
      lookupTenantSurfaceBindingForHost("admin.qa2.staging.test", "admin")?.tenantId,
      "f0ed9e65-2638-4351-847d-724f87ebbfce"
    );
  });

  it("fails closed for hosts absent from an enabled origin map", () => {
    process.env.TENANT_SURFACE_ORIGIN_MAP_JSON = JSON.stringify(map());
    assert.equal(lookupTenantSurfaceBindingForHost("attacker.example", "admin"), null);
    assert.equal(lookupTenantSurfaceBindingForHost("qa2.staging.test", "admin"), null);
    assert.throws(
      () => resolveTenantSurfaceOriginFromHost("attacker.example", "marketing"),
      /not allowlisted/
    );
  });

  it("resolves explicit legacy aliases only for their configured surface with host-only cookies", () => {
    process.env.TENANT_SURFACE_ORIGIN_MAP_JSON = JSON.stringify(map());
    const admin = resolveTenantSurfaceBindingForHost("staging-admin-denali.shenski.com", "admin");
    assert.equal(admin?.tenantId, "00000000-0000-4000-8000-000000000003");
    assert.equal(admin?.cookieDomain, "shenski.com");
    assert.equal(
      resolveTenantSurfaceOriginFromHost("staging-denali.shenski.com", "portal"),
      "https://portal.denali.staging.test"
    );
    assert.throws(
      () => resolveTenantSurfaceBindingForHost("staging-denali.shenski.com", "admin"),
      /does not match expected surface admin/
    );
  });

  it("rejects ambiguous forwarded host lists instead of selecting an allowlisted suffix", () => {
    process.env.TENANT_SURFACE_ORIGIN_MAP_JSON = JSON.stringify(map());
    assert.throws(
      () => resolveTenantSurfaceOriginFromHost("attacker.example, qa2.staging.test", "portal"),
      /one hostname/
    );
  });

  it("rejects a shared or nested cookie scope across tenants", () => {
    const invalid = map();
    invalid.tenants[0].cookieDomain = "unrelated.example";
    assert.throws(() => validateTenantSurfaceOriginMap(invalid), /cookieDomain .*not a parent/);

    const overlapping = map();
    overlapping.tenants[0].cookieDomain = "staging.test";
    assert.throws(
      () => validateTenantSurfaceOriginMap(overlapping),
      /cookie domains must not overlap/
    );

    const aliasedOverlap = map();
    aliasedOverlap.tenants[1].aliases = {
      admin: [{ origin: "https://legacy-admin.qa2.shenski.com", cookieDomain: "shenski.com" }],
    };
    assert.throws(
      () => validateTenantSurfaceOriginMap(aliasedOverlap),
      /cookie domains must not overlap/
    );

    const invalidAliasScope = map();
    invalidAliasScope.tenants[0].aliases.admin[0].cookieDomain = "unrelated.example";
    assert.throws(
      () => validateTenantSurfaceOriginMap(invalidAliasScope),
      /cookieDomain .*not a parent/
    );
  });

  it("rejects duplicate ingress hosts and non-HTTPS or path-bearing origins", () => {
    const duplicate = map();
    duplicate.tenants[1].origins.admin = duplicate.tenants[0].origins.admin;
    assert.throws(
      () => validateTenantSurfaceOriginMap(duplicate),
      /duplicate tenant surface hostname/
    );

    const insecure = map();
    insecure.tenants[1].origins.marketing = "http://qa2.staging.test";
    assert.throws(() => validateTenantSurfaceOriginMap(insecure), /portless HTTPS origin/);

    const trailingDot = map();
    trailingDot.tenants[1].origins.marketing = "https://qa2.staging.test.";
    assert.throws(() => validateTenantSurfaceOriginMap(trailingDot), /portless HTTPS origin/);
  });

  it("rejects an alias that collides with another tenant surface", () => {
    const invalid = map();
    invalid.tenants[0].aliases.admin = [
      { origin: "https://qa2.staging.test", cookieDomain: "qa2.staging.test" },
    ];
    assert.throws(
      () => validateTenantSurfaceOriginMap(invalid),
      /duplicate tenant surface hostname/
    );

    const nullAliases = map();
    nullAliases.tenants[0].aliases = null;
    assert.throws(() => validateTenantSurfaceOriginMap(nullAliases), /aliases must be an object/);
  });

  it("rejects trailing-dot host aliases for an otherwise allowlisted ingress", () => {
    process.env.TENANT_SURFACE_ORIGIN_MAP_JSON = JSON.stringify(map());
    assert.throws(
      () => resolveTenantSurfaceOriginFromHost("qa2.staging.test.", "portal"),
      /trailing dot/
    );
  });
});
