import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  activateFeatureFlagFreeze,
  isFeatureFlagFreezeActive,
  resetFeatureFlagFreezeForTests,
  resolveFeatureFlagFreezeDefaultSeconds,
} from "./feature-flag-freeze";
import {
  parseFeatureFlagsFromTheme,
  resolveTenantFeatureFlags,
} from "./resolve-tenant-feature-flags";
import {
  resetTenantRegistryCacheForTests,
  setCachedTenantThemeById,
} from "./tenant-registry-cache";

const envSnapshot = { ...process.env };

afterEach(() => {
  process.env = { ...envSnapshot };
  resetFeatureFlagFreezeForTests();
  resetTenantRegistryCacheForTests();
});

describe("feature-flag-freeze (DEC-120)", () => {
  it("defaults freeze duration to 600 seconds", () => {
    delete process.env.FEATURE_FLAG_FREEZE_DEFAULT_SEC;
    assert.equal(resolveFeatureFlagFreezeDefaultSeconds(), 600);
  });

  it("activateFeatureFlagFreeze enables freeze window", () => {
    activateFeatureFlagFreeze(30);
    assert.equal(isFeatureFlagFreezeActive(), true);
  });

  it("resolveTenantFeatureFlags uses cached theme only while frozen", async () => {
    process.env.DATABASE_URL = "postgresql://app:app@127.0.0.1:5432/app";
    const tenantId = "11111111-1111-4111-8111-111111111111";
    setCachedTenantThemeById(tenantId, {
      featureFlags: { advancedRuleEngine: false },
    });
    activateFeatureFlagFreeze(60);

    const flags = await resolveTenantFeatureFlags(tenantId);
    assert.deepEqual(
      flags,
      parseFeatureFlagsFromTheme({ featureFlags: { advancedRuleEngine: false } })
    );
  });
});
