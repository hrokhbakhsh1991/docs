import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { metricsRegistry, resetMetricsRegistryForTests } from "./metrics";
import {
  recordRegistrationSloEvent,
  recordValidationPipelineSloEvent,
  recordWorkspaceSloEvent,
} from "./workspace-slo-telemetry";

afterEach(() => {
  resetMetricsRegistryForTests();
});

describe("workspace-slo-telemetry (MAT-012)", () => {
  it("tags workspace A events separately from workspace B", () => {
    recordWorkspaceSloEvent({
      area: "api",
      outcome: "success",
      workspaceType: "denali",
      tenantId: "tenant-1",
    });
    recordWorkspaceSloEvent({
      area: "api",
      outcome: "success",
      workspaceType: "urban",
      tenantId: "tenant-1",
    });

    assert.equal(
      metricsRegistry.getMetric("workspace_slo_event_total", {
        area: "api",
        outcome: "success",
        workspace_type: "denali",
        tenant_id: "tenant-1",
      }),
      1
    );
    assert.equal(
      metricsRegistry.getMetric("workspace_slo_event_total", {
        area: "api",
        outcome: "success",
        workspace_type: "urban",
        tenant_id: "tenant-1",
      }),
      1
    );
  });

  it("rejects PII in metric labels", () => {
    assert.throws(
      () =>
        recordWorkspaceSloEvent({
          area: "registration",
          outcome: "error",
          workspaceType: "denali",
          tenantId: "user@example.com",
        }),
      /WORKSPACE_SLO_PII_LABEL_FORBIDDEN/
    );
  });

  it("bounds validation stage labels", () => {
    assert.throws(
      () =>
        recordWorkspaceSloEvent({
          area: "publish_write",
          outcome: "success",
          workspaceType: "denali",
          validationStage: "unbounded-stage" as "shared",
        }),
      /WORKSPACE_SLO_VALIDATION_STAGE_INVALID/
    );

    recordValidationPipelineSloEvent({
      workspaceType: "denali",
      tenantId: "tenant-1",
      stage: "capability",
      outcome: "success",
      capabilityId: "workspaceTransport",
      durationMs: 12.4,
    });

    assert.equal(
      metricsRegistry.getMetric("workspace_slo_event_total", {
        area: "publish_write",
        outcome: "success",
        workspace_type: "denali",
        tenant_id: "tenant-1",
        validation_stage: "capability",
        capability_id: "workspaceTransport",
      }),
      1
    );
    assert.equal(
      metricsRegistry.getGauge("workspace_slo_latency_ms", {
        area: "publish_write",
        outcome: "success",
        workspace_type: "denali",
        tenant_id: "tenant-1",
        validation_stage: "capability",
        capability_id: "workspaceTransport",
      }),
      12.4
    );
  });

  it("records registration journey events without unbounded ids", () => {
    recordRegistrationSloEvent({
      workspaceType: "denali",
      tenantId: "tenant-42",
      outcome: "success",
      durationMs: 88,
    });

    assert.equal(
      metricsRegistry.getMetric("workspace_slo_event_total", {
        area: "registration",
        outcome: "success",
        workspace_type: "denali",
        tenant_id: "tenant-42",
      }),
      1
    );
  });
});
