/**
 * 4-integration — tenant registry cache coherence for feature flags (DEC-090).
 *
 * Proves resolveTenantFeatureFlags reuses resolveTenantThemeJsonById cache
 * and reflects admin theme updates after DEC-074 invalidation.
 *
 * @see docs/phase-5/appendices/tenant-registry-cache-coherence.md
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

import type { PrismaClient } from "@prisma/client";

import { disconnectPrisma, getPrismaAdmin } from "../../src/db/prisma";
import {
  getAdminThemeLookupCountForTests,
  resetAdminThemeLookupCountForTests,
} from "../../src/tenant/resolve-registered-tenant";
import { resetTenantRegistryCacheForTests } from "../../src/tenant/tenant-registry-cache";
import {
  resolveTenantFeatureFlags,
  validationVariantForFeatureFlags,
} from "../../src/tenant/resolve-tenant-feature-flags";
import { updateTenantRegistryRow } from "../../src/tenant/update-tenant-registry-row";
import { integrationTenantId } from "../test-helpers";

const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());

describe(
  "4-integration — tenant registry cache coherence (feature flags)",
  {
    skip: hasDatabase
      ? false
      : "DATABASE_URL required — postgres theme cache (see apps/api/.env.example)",
    concurrency: false,
  },
  () => {
    const tenantId = integrationTenantId();
    const runId = randomUUID().slice(0, 8);
    let admin: PrismaClient;

    before(async () => {
      await disconnectPrisma();
      admin = getPrismaAdmin();
      resetTenantRegistryCacheForTests();
      resetAdminThemeLookupCountForTests();

      await admin.tenant.create({
        data: {
          id: tenantId,
          subdomain: `cache-coherence-${runId}`,
          workspaceType: "starter",
          theme: {
            featureFlags: { advancedRuleEngine: false },
          },
        },
      });
    });

    after(async () => {
      await admin.tenant.deleteMany({ where: { id: tenantId } }).catch(() => undefined);
      resetTenantRegistryCacheForTests();
      resetAdminThemeLookupCountForTests();
      await disconnectPrisma();
    });

    it("reuses theme cache — single admin lookup for repeated flag reads", async () => {
      resetTenantRegistryCacheForTests();
      resetAdminThemeLookupCountForTests();

      const first = await resolveTenantFeatureFlags(tenantId);
      const second = await resolveTenantFeatureFlags(tenantId);

      assert.equal(first.advancedRuleEngine, false);
      assert.deepEqual(second, first);
      assert.equal(getAdminThemeLookupCountForTests(), 1);
      assert.equal(validationVariantForFeatureFlags(first), "basic");
    });

    it("reflects theme update after updateTenantRegistryRow invalidation", async () => {
      resetTenantRegistryCacheForTests();
      resetAdminThemeLookupCountForTests();

      await updateTenantRegistryRow(tenantId, {
        theme: {
          featureFlags: { advancedRuleEngine: true },
        },
      });

      const flags = await resolveTenantFeatureFlags(tenantId);
      assert.equal(flags.advancedRuleEngine, true);
      assert.equal(validationVariantForFeatureFlags(flags), "default");
    });
  }
);
