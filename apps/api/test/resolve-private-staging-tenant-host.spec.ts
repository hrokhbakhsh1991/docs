import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { PlatformDomainRepository } from "../src/platform/platform-domain.repository.ts";
import { resolvePrivateStagingTenantHost } from "../src/platform/resolve-private-staging-tenant-host.ts";
import { resolveTenantFromCustomDomainHost } from "../src/platform/resolve-tenant-from-custom-domain.ts";

const tenantId = "f0ed9e65-2638-4351-847d-724f87ebbfce";
const originMap = {
  version: 1,
  tenants: [
    {
      tenantId,
      origins: {
        admin: "https://admin.qa2.staging.test",
        marketing: "https://qa2.staging.test",
        portal: "https://portal.qa2.staging.test",
      },
      cookieDomain: null,
    },
  ],
};

describe("private staging tenant host binding", () => {
  it("normalizes hostnames before checking all domain rows for collisions", async () => {
    let query: { where: { hostname: string } } | undefined;
    const repository = new PlatformDomainRepository({
      tenantDomain: {
        findFirst: async (args: { where: { hostname: string } }) => {
          query = args;
          return null;
        },
      },
    } as never);

    await repository.findByHostname("  ADMIN.QA2.STAGING.TEST  ");
    assert.deepEqual(query?.where, { hostname: "admin.qa2.staging.test" });
  });

  it("resolves only exact configured .staging.test hosts when the API profile is staging", () => {
    const env = {
      APP_INFRA_PROFILE: "staging",
      TENANT_SURFACE_ORIGIN_MAP_JSON: JSON.stringify(originMap),
    } as NodeJS.ProcessEnv;

    assert.deepEqual(resolvePrivateStagingTenantHost("qa2.staging.test", env), {
      tenantId,
      surface: "marketing",
    });
    assert.deepEqual(resolvePrivateStagingTenantHost("ADMIN.QA2.STAGING.TEST", env), {
      tenantId,
      surface: "admin",
    });
    assert.deepEqual(resolvePrivateStagingTenantHost("portal.qa2.staging.test", env), {
      tenantId,
      surface: "portal",
    });
    assert.equal(resolvePrivateStagingTenantHost("unlisted.staging.test", env), null);
    assert.equal(resolvePrivateStagingTenantHost("qa2.staging.test:443", env), null);
    assert.equal(
      resolvePrivateStagingTenantHost("qa2.staging.test", {
        ...env,
        APP_INFRA_PROFILE: "production",
      }),
      null
    );
  });

  it("fails closed on an invalid configured origin map", () => {
    assert.throws(
      () =>
        resolvePrivateStagingTenantHost("qa2.staging.test", {
          APP_INFRA_PROFILE: "staging",
          TENANT_SURFACE_ORIGIN_MAP_JSON: "{bad-json",
        } as NodeJS.ProcessEnv),
      /must contain valid JSON/
    );
  });

  it("resolves mapped staging hosts to the active tenant without public CNAME verification", async () => {
    const previousProfile = process.env.APP_INFRA_PROFILE;
    const previousMap = process.env.TENANT_SURFACE_ORIGIN_MAP_JSON;
    process.env.APP_INFRA_PROFILE = "staging";
    process.env.TENANT_SURFACE_ORIGIN_MAP_JSON = JSON.stringify(originMap);
    try {
      const result = await resolveTenantFromCustomDomainHost("portal.qa2.staging.test", {
        domainRepository: {
          findByHostname: async () => null,
          findVerifiedActiveByHostname: async () => {
            throw new Error("private staging binding must not use public CNAME lookup");
          },
        } as never,
        tenantRepository: {
          getById: async (id: string) => ({
            id,
            subdomain: "denali-qa2",
            status: "active",
          }),
        } as never,
      });
      assert.deepEqual(result, {
        tenantId,
        subdomain: "denali-qa2",
        surface: "portal",
      });
    } finally {
      if (previousProfile === undefined) delete process.env.APP_INFRA_PROFILE;
      else process.env.APP_INFRA_PROFILE = previousProfile;
      if (previousMap === undefined) delete process.env.TENANT_SURFACE_ORIGIN_MAP_JSON;
      else process.env.TENANT_SURFACE_ORIGIN_MAP_JSON = previousMap;
    }
  });

  it("does not resolve a private host to a suspended tenant", async () => {
    const previousProfile = process.env.APP_INFRA_PROFILE;
    const previousMap = process.env.TENANT_SURFACE_ORIGIN_MAP_JSON;
    process.env.APP_INFRA_PROFILE = "staging";
    process.env.TENANT_SURFACE_ORIGIN_MAP_JSON = JSON.stringify(originMap);
    try {
      const result = await resolveTenantFromCustomDomainHost("qa2.staging.test", {
        domainRepository: { findByHostname: async () => null } as never,
        tenantRepository: {
          getById: async () => ({ id: tenantId, subdomain: "denali-qa2", status: "suspended" }),
        } as never,
      });
      assert.equal(result, null);
    } finally {
      if (previousProfile === undefined) delete process.env.APP_INFRA_PROFILE;
      else process.env.APP_INFRA_PROFILE = previousProfile;
      if (previousMap === undefined) delete process.env.TENANT_SURFACE_ORIGIN_MAP_JSON;
      else process.env.TENANT_SURFACE_ORIGIN_MAP_JSON = previousMap;
    }
  });

  it("rejects a private host that collides with any public-domain row", async () => {
    const previousProfile = process.env.APP_INFRA_PROFILE;
    const previousMap = process.env.TENANT_SURFACE_ORIGIN_MAP_JSON;
    process.env.APP_INFRA_PROFILE = "staging";
    process.env.TENANT_SURFACE_ORIGIN_MAP_JSON = JSON.stringify(originMap);
    try {
      const result = await resolveTenantFromCustomDomainHost("qa2.staging.test", {
        domainRepository: {
          findByHostname: async () => ({ id: "domain-row" }),
        } as never,
        tenantRepository: {
          getById: async () => {
            throw new Error("colliding private binding must not resolve a tenant");
          },
        } as never,
      });
      assert.equal(result, null);
    } finally {
      if (previousProfile === undefined) delete process.env.APP_INFRA_PROFILE;
      else process.env.APP_INFRA_PROFILE = previousProfile;
      if (previousMap === undefined) delete process.env.TENANT_SURFACE_ORIGIN_MAP_JSON;
      else process.env.TENANT_SURFACE_ORIGIN_MAP_JSON = previousMap;
    }
  });
});
