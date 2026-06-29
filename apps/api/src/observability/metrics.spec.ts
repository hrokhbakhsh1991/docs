import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  METRIC_TENANT_LABEL_REQUIRED,
  metricsRegistry,
  recordFieldExposureCutoverSelection,
  recordFieldExposureEngineShadowMismatch,
  recordFieldExposureRuntimeSelection,
  recordFieldExposureShadowParityMismatch,
  recordIntegrationConnectionCreated,
  recordIntegrationDeliveryFailed,
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
    assert.ok(TENANT_SCOPED_METRIC_NAMES.has("integration_connection_created_total"));
    assert.ok(TENANT_SCOPED_METRIC_NAMES.has("integration_delivery_failed_total"));
    assert.ok(TENANT_SCOPED_METRIC_NAMES.has("field_exposure_runtime_selection_total"));
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

  it("records integration connection metrics with bounded labels", () => {
    const tenantId = integrationTenantId();
    recordIntegrationConnectionCreated({
      tenantId,
      provider: "telegram",
      workspaceType: "denali",
    });

    assert.equal(
      metricsRegistry.getMetric("integration_connection_created_total", {
        tenant_id: tenantId,
        provider: "telegram",
        workspace_type: "denali",
      }),
      1
    );
  });

  it("records integration delivery failure metrics with reason labels", () => {
    const tenantId = integrationTenantId();
    recordIntegrationDeliveryFailed({
      tenantId,
      provider: "telegram",
      capability: "message.send",
      reason: "INTEGRATION_CONFIG_INCOMPLETE",
    });

    assert.equal(
      metricsRegistry.getMetric("integration_delivery_failed_total", {
        tenant_id: tenantId,
        provider: "telegram",
        capability: "message.send",
        reason: "INTEGRATION_CONFIG_INCOMPLETE",
      }),
      1
    );
  });

  it("records field exposure shadow parity mismatch metrics with bounded labels", () => {
    const tenantId = integrationTenantId();
    recordFieldExposureShadowParityMismatch({
      tenantId,
      eventType: "TourCreated",
      provider: "telegram",
      mismatchCount: 2,
    });

    assert.equal(
      metricsRegistry.getMetric("field_exposure_shadow_parity_mismatch_total", {
        tenant_id: tenantId,
        event_type: "TourCreated",
        provider: "telegram",
        mismatch_count: "2",
      }),
      1
    );
  });

  it("records field exposure cutover selection metrics with bounded labels", () => {
    const tenantId = integrationTenantId();
    recordFieldExposureCutoverSelection({
      tenantId,
      eventType: "TourCreated",
      provider: "telegram",
      selectionSource: "native_exposure_intent",
      nativeIntentMissing: false,
    });

    assert.equal(
      metricsRegistry.getMetric("field_exposure_cutover_selection_total", {
        tenant_id: tenantId,
        event_type: "TourCreated",
        provider: "telegram",
        selection_source: "native_exposure_intent",
        native_intent_missing: "false",
      }),
      1
    );
  });

  it("records field exposure runtime selection metrics with mode labels", () => {
    const tenantId = integrationTenantId();
    recordFieldExposureRuntimeSelection({
      tenantId,
      eventType: "TourCreated",
      provider: "telegram",
      runtimeMode: "shadow",
      selectionSource: "exposure_profile_defaults",
      nativeIntentMissing: true,
    });

    assert.equal(
      metricsRegistry.getMetric("field_exposure_runtime_selection_total", {
        tenant_id: tenantId,
        event_type: "TourCreated",
        provider: "telegram",
        runtime_mode: "shadow",
        selection_source: "exposure_profile_defaults",
        native_intent_missing: "true",
      }),
      1,
    );
  });

  it("records forward engine shadow mismatch count with bounded labels", () => {
    const tenantId = integrationTenantId();
    recordFieldExposureEngineShadowMismatch({
      tenantId,
      eventType: "TourCreated",
      surface: "telegram",
      mismatchCount: 3,
    });

    assert.equal(
      metricsRegistry.getMetric("field_exposure_engine_shadow_mismatch_total", {
        tenant_id: tenantId,
        event_type: "TourCreated",
        surface: "telegram",
      }),
      3,
    );
  });

  it("does not increment forward engine shadow mismatch metric when mismatch count is zero", () => {
    const tenantId = integrationTenantId();
    assert.equal(
      metricsRegistry.getMetric("field_exposure_engine_shadow_mismatch_total", {
        tenant_id: tenantId,
        event_type: "TourCreated",
        surface: "telegram",
      }),
      0,
    );
  });
});
