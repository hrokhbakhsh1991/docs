import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { metricsRegistry, resetMetricsRegistryForTests } from "../observability/metrics";
import {
  readOutboxRelayInFlightMaxPerTenant,
  readOutboxRelayInFlightTotal,
  readOutboxRelayTenantsActive,
  resolveOutboxRelayInFlightAlertMaxPerTenant,
  resolveOutboxRelayInFlightAlertTotal,
} from "./outbox-relay-monitor";
import {
  releaseOutboxRelayTenantSlot,
  resetOutboxRelayTenantBudgetForTests,
  tryAcquireOutboxRelayTenantSlot,
} from "./outbox-relay-tenant-budget";
import { integrationTenantId } from "../../test/test-helpers";

describe("outbox-relay-monitor (B4 / NN-06)", () => {
  const prevMax = process.env.OUTBOX_RELAY_MAX_IN_FLIGHT_PER_TENANT;

  afterEach(() => {
    resetOutboxRelayTenantBudgetForTests();
    resetMetricsRegistryForTests();
    delete process.env.OUTBOX_RELAY_IN_FLIGHT_ALERT_TOTAL;
    delete process.env.OUTBOX_RELAY_IN_FLIGHT_ALERT_MAX_PER_TENANT;
    if (prevMax === undefined) {
      delete process.env.OUTBOX_RELAY_MAX_IN_FLIGHT_PER_TENANT;
    } else {
      process.env.OUTBOX_RELAY_MAX_IN_FLIGHT_PER_TENANT = prevMax;
    }
  });

  it("defaults alert thresholds", () => {
    assert.equal(resolveOutboxRelayInFlightAlertTotal(), 12);
    assert.equal(resolveOutboxRelayInFlightAlertMaxPerTenant(), 3);
  });

  it("reports in-flight gauges from relay tenant budget snapshot", () => {
    process.env.OUTBOX_RELAY_MAX_IN_FLIGHT_PER_TENANT = "3";
    const tenantA = integrationTenantId();
    const tenantB = integrationTenantId();

    assert.equal(tryAcquireOutboxRelayTenantSlot(tenantA), true);
    assert.equal(tryAcquireOutboxRelayTenantSlot(tenantA), true);
    assert.equal(tryAcquireOutboxRelayTenantSlot(tenantB), true);

    assert.equal(readOutboxRelayInFlightTotal(), 3);
    assert.equal(readOutboxRelayInFlightMaxPerTenant(), 2);
    assert.equal(readOutboxRelayTenantsActive(), 2);

    releaseOutboxRelayTenantSlot(tenantA);
    releaseOutboxRelayTenantSlot(tenantA);
    releaseOutboxRelayTenantSlot(tenantB);
  });

  it("tracks deferred counter at cap (DEC-066)", () => {
    process.env.OUTBOX_RELAY_MAX_IN_FLIGHT_PER_TENANT = "1";
    const tenantId = integrationTenantId();

    assert.equal(tryAcquireOutboxRelayTenantSlot(tenantId), true);
    assert.equal(tryAcquireOutboxRelayTenantSlot(tenantId), false);
    assert.equal(
      metricsRegistry.getMetric("outbox_relay_tenant_deferred_total", { tenant_id: tenantId }),
      1
    );

    releaseOutboxRelayTenantSlot(tenantId);
  });
});
