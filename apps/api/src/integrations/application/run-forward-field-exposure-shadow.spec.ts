import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { logger } from "../../observability/logger";
import { metricsRegistry, resetMetricsRegistryForTests } from "../../observability/metrics";
import {
  FIELD_EXPOSURE_DECISION_ENGINE_SHADOW_ENV,
  runForwardFieldExposureDecisionEngineShadow,
} from "./dispatch-integration-domain-event";

describe("runForwardFieldExposureDecisionEngineShadow", () => {
  let previousFlag: string | undefined;

  afterEach(() => {
    if (previousFlag === undefined) {
      delete process.env[FIELD_EXPOSURE_DECISION_ENGINE_SHADOW_ENV];
    } else {
      process.env[FIELD_EXPOSURE_DECISION_ENGINE_SHADOW_ENV] = previousFlag;
    }
    previousFlag = undefined;
    resetMetricsRegistryForTests();
  });

  it("is a no-op when the forward shadow flag is disabled", () => {
    previousFlag = process.env[FIELD_EXPOSURE_DECISION_ENGINE_SHADOW_ENV];
    delete process.env[FIELD_EXPOSURE_DECISION_ENGINE_SHADOW_ENV];

    const infoCalls: unknown[] = [];
    const originalInfo = logger.info.bind(logger);
    (logger.info as unknown as (...args: unknown[]) => void) = (...args: unknown[]) => {
      infoCalls.push(...args);
    };

    try {
      runForwardFieldExposureDecisionEngineShadow({
        tenantId: "tenant-a",
        eventType: "TourCreated",
        workspaceType: "denali",
        surface: "telegram",
        payload: { tourId: "tour-1" },
        legacyEligibleFieldIds: ["title"],
        legacyCandidateFieldIds: ["title"],
      });

      assert.equal(infoCalls.length, 0);
    } finally {
      (logger.info as unknown as (...args: unknown[]) => void) = originalInfo;
    }
  });

  it("skips shadow work when workspace type is absent", () => {
    previousFlag = process.env[FIELD_EXPOSURE_DECISION_ENGINE_SHADOW_ENV];
    process.env[FIELD_EXPOSURE_DECISION_ENGINE_SHADOW_ENV] = "true";

    const infoCalls: unknown[] = [];
    const originalInfo = logger.info.bind(logger);
    (logger.info as unknown as (...args: unknown[]) => void) = (...args: unknown[]) => {
      infoCalls.push(...args);
    };

    try {
      runForwardFieldExposureDecisionEngineShadow({
        tenantId: "tenant-a",
        eventType: "TourCreated",
        workspaceType: null,
        surface: "telegram",
        payload: { tourId: "tour-1" },
        legacyEligibleFieldIds: [],
        legacyCandidateFieldIds: [],
      });

      assert.equal(infoCalls.length, 0);
    } finally {
      (logger.info as unknown as (...args: unknown[]) => void) = originalInfo;
    }
  });

  it("logs a warning and does not throw when plugin resolution fails", () => {
    previousFlag = process.env[FIELD_EXPOSURE_DECISION_ENGINE_SHADOW_ENV];
    process.env[FIELD_EXPOSURE_DECISION_ENGINE_SHADOW_ENV] = "true";

    const warnCalls: Record<string, unknown>[] = [];
    const originalWarn = logger.warn.bind(logger);
    (logger.warn as unknown as (obj: Record<string, unknown>) => void) = (obj) => {
      warnCalls.push(obj);
    };

    try {
      assert.doesNotThrow(() =>
        runForwardFieldExposureDecisionEngineShadow({
          tenantId: "tenant-a",
          eventType: "TourCreated",
          workspaceType: "unknown-workspace",
          surface: "telegram",
          payload: { tourId: "tour-1" },
          legacyEligibleFieldIds: [],
          legacyCandidateFieldIds: [],
        }),
      );

      assert.equal(warnCalls.length, 1);
      assert.equal(warnCalls[0]?.event, "field_exposure_decision_engine.shadow.failed");
      assert.equal(warnCalls[0]?.tenantId, "tenant-a");
    } finally {
      (logger.warn as unknown as (...args: unknown[]) => void) = originalWarn;
    }
  });

  it("emits exactly one aggregate parity summary per enabled shadow run", () => {
    previousFlag = process.env[FIELD_EXPOSURE_DECISION_ENGINE_SHADOW_ENV];
    process.env[FIELD_EXPOSURE_DECISION_ENGINE_SHADOW_ENV] = "true";

    const infoCalls: Record<string, unknown>[] = [];
    const originalInfo = logger.info.bind(logger);
    (logger.info as unknown as (obj: Record<string, unknown>) => void) = (obj) => {
      infoCalls.push(obj);
    };

    try {
      runForwardFieldExposureDecisionEngineShadow({
        tenantId: "tenant-a",
        eventType: "TourCreated",
        workspaceType: "starter",
        surface: "telegram",
        payload: { status: "published", title: "Alpine Day" },
        legacyEligibleFieldIds: ["basics.title", "details.summary"],
        legacyCandidateFieldIds: ["basics.title", "details.summary"],
      });

      const summaries = infoCalls.filter(
        (call) => call.event === "field_exposure.shadow_parity_summary",
      );

      assert.equal(summaries.length, 1);
      assert.deepEqual(summaries[0], {
        event: "field_exposure.shadow_parity_summary",
        tenantId: "tenant-a",
        eventType: "TourCreated",
        workspaceType: "starter",
        surface: "telegram",
        matches: true,
        mismatchCount: 0,
        fieldCount: 4,
      });
    } finally {
      (logger.info as unknown as (...args: unknown[]) => void) = originalInfo;
    }
  });

  it("records forward engine shadow mismatch metric when aggregate parity fails", () => {
    previousFlag = process.env[FIELD_EXPOSURE_DECISION_ENGINE_SHADOW_ENV];
    process.env[FIELD_EXPOSURE_DECISION_ENGINE_SHADOW_ENV] = "true";

    const originalInfo = logger.info.bind(logger);
    (logger.info as unknown as (...args: unknown[]) => void) = () => {};

    try {
      runForwardFieldExposureDecisionEngineShadow({
        tenantId: "tenant-a",
        eventType: "TourCreated",
        workspaceType: "starter",
        surface: "telegram",
        payload: { status: "published", title: "Alpine Day" },
        legacyEligibleFieldIds: ["basics.title"],
        legacyCandidateFieldIds: ["basics.title"],
      });

      assert.equal(
        metricsRegistry.getMetric("field_exposure_engine_shadow_mismatch_total", {
          tenant_id: "tenant-a",
          event_type: "TourCreated",
          surface: "telegram",
        }),
        1,
      );
    } finally {
      (logger.info as unknown as (...args: unknown[]) => void) = originalInfo;
    }
  });
});
