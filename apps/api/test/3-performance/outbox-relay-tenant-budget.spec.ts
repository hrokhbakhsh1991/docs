/**
 * Phase 3 step 15 — outbox relay per-tenant budget (DEC-066 / SCAL-DEBT-10).
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  getActiveOutboxRelayPublishesForTests,
  resetOutboxRelayTenantBudgetForTests,
  releaseOutboxRelayTenantSlot,
  tryAcquireOutboxRelayTenantSlot,
} from "../../src/outbox/outbox-relay-tenant-budget";
import { metricsRegistry, resetMetricsRegistryForTests } from "../../src/observability/metrics";
import { integrationTenantId } from "../test-helpers";

describe("outbox relay tenant budget (DEC-066)", () => {
  const prevMax = process.env.OUTBOX_RELAY_MAX_IN_FLIGHT_PER_TENANT;

  afterEach(() => {
    resetOutboxRelayTenantBudgetForTests();
    resetMetricsRegistryForTests();
    if (prevMax === undefined) {
      delete process.env.OUTBOX_RELAY_MAX_IN_FLIGHT_PER_TENANT;
    } else {
      process.env.OUTBOX_RELAY_MAX_IN_FLIGHT_PER_TENANT = prevMax;
    }
  });

  it("defers when tenant exceeds in-flight publish cap", () => {
    process.env.OUTBOX_RELAY_MAX_IN_FLIGHT_PER_TENANT = "2";
    const tenantId = integrationTenantId();

    assert.equal(tryAcquireOutboxRelayTenantSlot(tenantId), true);
    assert.equal(tryAcquireOutboxRelayTenantSlot(tenantId), true);
    assert.equal(getActiveOutboxRelayPublishesForTests(tenantId), 2);

    assert.equal(tryAcquireOutboxRelayTenantSlot(tenantId), false);
    assert.equal(
      metricsRegistry.getMetric("outbox_relay_tenant_deferred_total", { tenant_id: tenantId }),
      1
    );

    releaseOutboxRelayTenantSlot(tenantId);
    assert.equal(getActiveOutboxRelayPublishesForTests(tenantId), 1);
    assert.equal(tryAcquireOutboxRelayTenantSlot(tenantId), true);
  });

  it("isolates in-flight publish counters per tenant", () => {
    process.env.OUTBOX_RELAY_MAX_IN_FLIGHT_PER_TENANT = "1";
    const tenantA = integrationTenantId();
    const tenantB = integrationTenantId();

    assert.equal(tryAcquireOutboxRelayTenantSlot(tenantA), true);
    assert.equal(tryAcquireOutboxRelayTenantSlot(tenantA), false);
    assert.equal(tryAcquireOutboxRelayTenantSlot(tenantB), true);

    releaseOutboxRelayTenantSlot(tenantA);
    releaseOutboxRelayTenantSlot(tenantB);
  });
});
