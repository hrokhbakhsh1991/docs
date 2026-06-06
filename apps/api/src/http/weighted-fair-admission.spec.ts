import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import {
  PriorityLoadShedError,
  acquireWeightedFairAdmission,
  getGlobalHttpInflightForTests,
  readGlobalHttpInflightMax,
  readLowTierShedWatermark,
  releaseWeightedFairAdmission,
  resetWeightedFairAdmissionForTests,
} from "./weighted-fair-admission";
import {
  resetTenantRegistryCacheForTests,
  setCachedTenantThemeById,
} from "../tenant/tenant-registry-cache";

describe("weighted fair admission (DEC-114)", () => {
  // Slug ids — avoid Postgres UUID branch on CI (seeded rows would override theme cache).
  const tenantLow = "dec114-tenant-low";
  const tenantHigh = "dec114-tenant-high";

  beforeEach(() => {
    resetWeightedFairAdmissionForTests();
    resetTenantRegistryCacheForTests();
    process.env.PRIORITY_LOAD_SHED_ENABLED = "true";
  });

  afterEach(() => {
    resetWeightedFairAdmissionForTests();
    resetTenantRegistryCacheForTests();
    process.env.PRIORITY_LOAD_SHED_ENABLED = "true";
    delete process.env.GLOBAL_HTTP_INFLIGHT_MAX;
    delete process.env.GLOBAL_HTTP_LOW_TIER_SHED_WATERMARK;
    delete process.env.GLOBAL_HTTP_NORMAL_TIER_SHED_WATERMARK;
  });

  it("sheds low tier before normal watermark is reached", async () => {
    process.env.GLOBAL_HTTP_INFLIGHT_MAX = "10";
    process.env.GLOBAL_HTTP_LOW_TIER_SHED_WATERMARK = "2";
    setCachedTenantThemeById(tenantLow, { priorityTier: "low" });
    setCachedTenantThemeById(tenantHigh, { priorityTier: "high" });

    await acquireWeightedFairAdmission(tenantHigh);
    await acquireWeightedFairAdmission(tenantHigh);

    await assert.rejects(
      () => acquireWeightedFairAdmission(tenantLow),
      (error: unknown) => error instanceof PriorityLoadShedError
    );
    assert.equal(getGlobalHttpInflightForTests(), 2);
  });

  it("allows high tier until hard max", async () => {
    process.env.GLOBAL_HTTP_INFLIGHT_MAX = "3";
    process.env.GLOBAL_HTTP_LOW_TIER_SHED_WATERMARK = "1";
    process.env.GLOBAL_HTTP_NORMAL_TIER_SHED_WATERMARK = "2";
    setCachedTenantThemeById(tenantHigh, { priorityTier: "high" });

    await acquireWeightedFairAdmission(tenantHigh);
    await acquireWeightedFairAdmission(tenantHigh);
    await acquireWeightedFairAdmission(tenantHigh);
    assert.equal(getGlobalHttpInflightForTests(), 3);

    await assert.rejects(() => acquireWeightedFairAdmission(tenantHigh), PriorityLoadShedError);
  });

  it("release decrements inflight", async () => {
    setCachedTenantThemeById(tenantHigh, { priorityTier: "high" });
    await acquireWeightedFairAdmission(tenantHigh);
    releaseWeightedFairAdmission();
    assert.equal(getGlobalHttpInflightForTests(), 0);
  });

  it("readLowTierShedWatermark uses ratio when env unset", () => {
    const max = readGlobalHttpInflightMax();
    assert.equal(readLowTierShedWatermark(max), Math.floor(max * 0.6));
  });
});
