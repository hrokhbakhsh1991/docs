import assert from "node:assert/strict";
import { after, afterEach, before, describe, it } from "node:test";

import { PrismaClient } from "@prisma/client";

import {
  parseRateLimitRpsFromTheme,
  resolveEffectiveRateLimitForTenant,
} from "../middleware/tenant-rate-limiter";
import {
  getAdminThemeLookupCountForTests,
  resetAdminThemeLookupCountForTests,
  resolveTenantThemeJsonById,
} from "./resolve-registered-tenant";
import {
  getCachedTenantThemeById,
  resetTenantRegistryCacheForTests,
  setCachedTenantThemeById,
} from "./tenant-registry-cache";
import { integrationTenantId } from "../../test/test-helpers";

const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());

const ADMIN_URL =
  process.env.DATABASE_URL_ADMIN?.trim() ?? "postgresql://postgres:postgres@127.0.0.1:5434/tour_db";

describe("resolveTenantThemeJsonById cache (DEC-053)", () => {
  afterEach(() => {
    resetTenantRegistryCacheForTests();
    resetAdminThemeLookupCountForTests();
  });

  it("parseRateLimitRpsFromTheme prefers root rateLimitRps", () => {
    assert.equal(parseRateLimitRpsFromTheme({ rateLimitRps: 12 }), 12);
    assert.equal(
      parseRateLimitRpsFromTheme({ featureFlags: { rateLimitRps: 5 }, rateLimitRps: 20 }),
      20
    );
  });

  it("resolveEffectiveRateLimitForTenant uses cached theme override", async () => {
    if (!hasDatabase) {
      return;
    }

    const tenantId = integrationTenantId();
    setCachedTenantThemeById(tenantId, { rateLimitRps: 7 });
    const effective = await resolveEffectiveRateLimitForTenant(tenantId, {
      enabled: true,
      points: 50,
      durationSec: 1,
    });
    assert.equal(effective.points, 7);
    assert.equal(getAdminThemeLookupCountForTests(), 0);
  });

  it("negative-caches unknown tenant theme without repeated admin lookups", async () => {
    if (!hasDatabase) {
      return;
    }

    const unknownId = integrationTenantId();
    resetAdminThemeLookupCountForTests();

    const first = await resolveTenantThemeJsonById(unknownId);
    const second = await resolveTenantThemeJsonById(unknownId);

    assert.equal(first, null);
    assert.equal(second, null);
    assert.equal(getAdminThemeLookupCountForTests(), 1);
    assert.equal(getCachedTenantThemeById(unknownId), null);
  });
});

describe("resolveTenantThemeJsonById postgres integration", { skip: !hasDatabase }, () => {
  const prisma = new PrismaClient({ datasources: { db: { url: ADMIN_URL } } });
  let tenantId = "";

  before(async () => {
    tenantId = integrationTenantId();
    await prisma.tenant.upsert({
      where: { id: tenantId },
      create: {
        id: tenantId,
        subdomain: `theme-cache-${tenantId.slice(0, 8)}`,
        workspaceType: "starter",
        status: "ACTIVE",
        theme: { rateLimitRps: 15 },
      },
      update: {
        theme: { rateLimitRps: 15 },
      },
    });
    resetTenantRegistryCacheForTests();
    resetAdminThemeLookupCountForTests();
  });

  after(async () => {
    await prisma.tenant.deleteMany({ where: { id: tenantId } }).catch(() => undefined);
    await prisma.$disconnect();
    resetTenantRegistryCacheForTests();
    resetAdminThemeLookupCountForTests();
  });

  it("loads theme once then serves from cache", async () => {
    resetAdminThemeLookupCountForTests();

    const first = await resolveTenantThemeJsonById(tenantId);
    const second = await resolveTenantThemeJsonById(tenantId);

    assert.deepEqual(first, { rateLimitRps: 15 });
    assert.deepEqual(second, { rateLimitRps: 15 });
    assert.equal(getAdminThemeLookupCountForTests(), 1);

    const effective = await resolveEffectiveRateLimitForTenant(tenantId, {
      enabled: true,
      points: 50,
      durationSec: 1,
    });
    assert.equal(effective.points, 15);
    assert.equal(getAdminThemeLookupCountForTests(), 1);
  });
});
