import assert from "node:assert/strict";
import { describe, it, afterEach } from "node:test";

import { metricsRegistry, resetMetricsRegistryForTests } from "../observability/metrics";
import {
  readAdminPoolReadP99Ms,
  readAdminPoolReadSlowTotal,
  recordAdminPoolRead,
  recordTenantRegistryCacheHit,
  recordTenantRegistryCacheMiss,
  resetAdminPoolReadMonitorForTests,
  resolveAdminPoolReadBudgetMs,
} from "./admin-pool-read-monitor";

describe("admin-pool-read-monitor (B1 / NN-03)", () => {
  afterEach(() => {
    resetAdminPoolReadMonitorForTests();
    resetMetricsRegistryForTests();
    delete process.env.ADMIN_POOL_READ_BUDGET_MS;
  });

  it("defaults budget to 500ms", () => {
    assert.equal(resolveAdminPoolReadBudgetMs(), 500);
  });

  it("records cache hit/miss with bounded kind label", () => {
    recordTenantRegistryCacheHit("by_id");
    recordTenantRegistryCacheMiss("theme");
    assert.equal(
      metricsRegistry.getMetric("tenant_registry_cache_hit_total", { kind: "by_id" }),
      1
    );
    assert.equal(
      metricsRegistry.getMetric("tenant_registry_cache_miss_total", { kind: "theme" }),
      1
    );
  });

  it("increments slow counter when read exceeds budget", () => {
    process.env.ADMIN_POOL_READ_BUDGET_MS = "100";
    recordAdminPoolRead(50);
    recordAdminPoolRead(150);
    assert.equal(readAdminPoolReadSlowTotal(), 1);
    assert.equal(metricsRegistry.getMetric("admin_pool_read_slow_total"), 1);
    assert.ok(readAdminPoolReadP99Ms() >= 150);
  });
});
