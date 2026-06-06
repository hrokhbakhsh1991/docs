/**
 * 2-observability — tenant-scoped tour_creation_count metrics.
 *
 * Creates 50 tours for tenant A and 10 for tenant B via ToursService (memory storage),
 * then reads the in-process metrics registry and asserts per-tenant label separation.
 *
 * FAIL if metrics ignore tenant_id labels or aggregate into a single unlabeled total.
 *
 * Run:
 *   cd apps/api && NODE_ENV=test STORAGE_DRIVER=memory node --import tsx --test test/2-observability/tenant-metrics.spec.ts
 *
 * @see docs/phase-5/appendices/tenant-metrics.md
 */
import assert from "node:assert/strict";
import { after, beforeEach, describe, it } from "node:test";

import type { TenantAuthContext } from "@app-tour/workspace-sdk";

import { metricsRegistry, resetMetricsRegistryForTests } from "../../src/observability/metrics";
import { createTestToursService, integrationTenantId } from "../test-helpers";

const VALID_TOUR_BODY = {
  data: { basics: { title: "tenant-metrics-tour" }, details: { summary: "ok" } },
} as const;

const TENANT_A_CREATES = 50;
const TENANT_B_CREATES = 10;

function authForTenant(tenantId: string): TenantAuthContext {
  return {
    userId: "tenant-metrics-user",
    tenantId,
    role: "admin",
    status: "ACTIVE",
    workspaceId: "ws-tenant-metrics",
  };
}

async function createToursForTenant(
  service: ReturnType<typeof createTestToursService>,
  tenantId: string,
  count: number
): Promise<void> {
  for (let i = 0; i < count; i += 1) {
    await service.createTour(authForTenant(tenantId), {
      ...VALID_TOUR_BODY,
      data: {
        ...VALID_TOUR_BODY.data,
        basics: { title: `tenant-metrics-${tenantId.slice(0, 8)}-${i}` },
      },
    });
  }
}

describe("2-observability — tenant-scoped tour_creation_count", () => {
  const priorStorageDriver = process.env.STORAGE_DRIVER;
  const priorOutboxRelay = process.env.OUTBOX_RELAY_ENABLED;

  beforeEach(() => {
    resetMetricsRegistryForTests();
    process.env.STORAGE_DRIVER = "memory";
    process.env.OUTBOX_RELAY_ENABLED = "false";
  });

  after(() => {
    resetMetricsRegistryForTests();
    if (priorStorageDriver === undefined) {
      delete process.env.STORAGE_DRIVER;
    } else {
      process.env.STORAGE_DRIVER = priorStorageDriver;
    }
    if (priorOutboxRelay === undefined) {
      delete process.env.OUTBOX_RELAY_ENABLED;
    } else {
      process.env.OUTBOX_RELAY_ENABLED = priorOutboxRelay;
    }
  });

  it("OBS-MET-01: tour_creation_count is labeled per tenant_id (A=50, B=10)", async () => {
    const tenantA = integrationTenantId();
    const tenantB = integrationTenantId();
    assert.notEqual(tenantA, tenantB, "test tenants must differ");

    const service = createTestToursService();

    await createToursForTenant(service, tenantA, TENANT_A_CREATES);
    await createToursForTenant(service, tenantB, TENANT_B_CREATES);

    const countA = metricsRegistry.getMetric("tour_creation_count", { tenant_id: tenantA });
    const countB = metricsRegistry.getMetric("tour_creation_count", { tenant_id: tenantB });

    assert.equal(
      countA,
      TENANT_A_CREATES,
      `tenant A tour_creation_count must be ${TENANT_A_CREATES}, got ${countA}`
    );
    assert.equal(
      countB,
      TENANT_B_CREATES,
      `tenant B tour_creation_count must be ${TENANT_B_CREATES}, got ${countB}`
    );

    const unlabeledTotal = metricsRegistry.getMetric("tour_creation_count");
    assert.equal(
      unlabeledTotal,
      0,
      "tour_creation_count must not aggregate without tenant_id label"
    );

    const combinedLabeled = countA + countB;
    assert.equal(
      combinedLabeled,
      TENANT_A_CREATES + TENANT_B_CREATES,
      "labeled totals must sum to total successful creates"
    );

    const snapshot = metricsRegistry.snapshotCounters();
    const tourSeries = [...snapshot.entries()].filter(([key]) =>
      key.startsWith("tour_creation_count")
    );
    assert.equal(
      tourSeries.length,
      2,
      `expected exactly two tour_creation_count series (one per tenant), got: ${JSON.stringify(tourSeries)}`
    );
  });
});
