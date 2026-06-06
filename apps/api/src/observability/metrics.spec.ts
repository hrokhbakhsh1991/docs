import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  METRIC_TENANT_LABEL_REQUIRED,
  metricsRegistry,
  resetMetricsRegistryForTests,
  TENANT_SCOPED_METRIC_NAMES,
} from "./metrics.js";
import { integrationTenantId } from "../../test/test-helpers";

afterEach(() => {
  resetMetricsRegistryForTests();
});

describe("tenant-scoped metrics (MET-API-01 / DEC-049)", () => {
  it("TENANT_SCOPED_METRIC_NAMES includes tour and projection counters", () => {
    assert.ok(TENANT_SCOPED_METRIC_NAMES.has("tour_creation_count"));
    assert.ok(TENANT_SCOPED_METRIC_NAMES.has("projection_inconsistency_total"));
  });

  it("rejects unlabeled tour_creation_count increment", () => {
    assert.throws(
      () => metricsRegistry.increment("tour_creation_count"),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal(error.message, `${METRIC_TENANT_LABEL_REQUIRED}:tour_creation_count`);
        return true;
      }
    );
  });

  it("rejects empty tenant_id label", () => {
    assert.throws(
      () => metricsRegistry.increment("tour_creation_count", { tenant_id: "  " }),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal(error.message, `${METRIC_TENANT_LABEL_REQUIRED}:tour_creation_count`);
        return true;
      }
    );
  });

  it("allows labeled tenant increment", () => {
    const tenantId = integrationTenantId();
    metricsRegistry.increment("tour_creation_count", { tenant_id: tenantId });
    assert.equal(metricsRegistry.getMetric("tour_creation_count", { tenant_id: tenantId }), 1);
  });

  it("rejects unlabeled projection_inconsistency_total increment (MET-COV-01)", () => {
    assert.throws(
      () => metricsRegistry.increment("projection_inconsistency_total"),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal(
          error.message,
          `${METRIC_TENANT_LABEL_REQUIRED}:projection_inconsistency_total`
        );
        return true;
      }
    );
  });

  it("allows labeled projection_inconsistency_total increment", () => {
    const tenantId = integrationTenantId();
    metricsRegistry.increment("projection_inconsistency_total", { tenant_id: tenantId });
    assert.equal(
      metricsRegistry.getMetric("projection_inconsistency_total", { tenant_id: tenantId }),
      1
    );
  });

  it("allows non-tenant-scoped metrics without tenant_id", () => {
    metricsRegistry.increment("platform_health_probe_total");
    assert.equal(metricsRegistry.getMetric("platform_health_probe_total"), 1);
  });
});
