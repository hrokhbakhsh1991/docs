import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const REPO_ROOT = join(process.cwd(), "..", "..");
const EXPOSURE_DOC = join(REPO_ROOT, "docs/architecture/field-exposure-system.md");
const DISPATCH = join(
  REPO_ROOT,
  "apps/api/src/integrations/application/dispatch-integration-domain-event.ts",
);
const DISPATCH_SPEC = join(
  REPO_ROOT,
  "apps/api/src/integrations/application/dispatch-integration-domain-event.spec.ts",
);
const METRICS = join(REPO_ROOT, "apps/api/src/observability/metrics.ts");
const METRICS_SPEC = join(REPO_ROOT, "apps/api/src/observability/metrics.spec.ts");

describe("field exposure phase 13 runtime selection metric contract", () => {
  it("documents Phase 13 runtime selection metric cleanup", () => {
    const text = readFileSync(EXPOSURE_DOC, "utf8");

    assert.match(text, /Unified Control Plane Migration — Phase 13/);
    assert.match(text, /field_exposure_runtime_selection_total/);
    assert.match(text, /field_exposure_cutover_selection_total/);
    assert.match(text, /native_intent_missing/);
    assert.match(text, /dispatch-integration-domain-event\.spec\.ts/);
    assert.match(text, /metrics\.spec\.ts/);
    assert.match(text, /field-exposure-phase-13-runtime-selection\.contract\.spec\.ts/);
  });

  it("defines mode-independent runtime selection metrics with tenant labels", () => {
    const metrics = readFileSync(METRICS, "utf8");

    assert.match(metrics, /field_exposure_runtime_selection_total/);
    assert.match(metrics, /recordFieldExposureRuntimeSelection/);
    assert.match(metrics, /runtime_mode: input\.runtimeMode/);
    assert.match(metrics, /native_intent_missing: input\.nativeIntentMissing/);
    assert.match(metrics, /Phase 13 — auditable runtime selection decisions in every diagnostic runtime mode/);
    assert.match(metrics, /TENANT_SCOPED_METRIC_NAMES[\s\S]*field_exposure_runtime_selection_total/);
  });

  it("records runtime selection outside cutover-only compatibility metrics", () => {
    const dispatch = readFileSync(DISPATCH, "utf8");
    const runtimeMetricIndex = dispatch.indexOf("recordFieldExposureRuntimeSelection({");
    const cutoverMetricIndex = dispatch.indexOf("recordFieldExposureCutoverSelection({");
    const cutoverGuardIndex = dispatch.indexOf('if (runtimeMode === "cutover") {', runtimeMetricIndex);

    assert.notEqual(runtimeMetricIndex, -1);
    assert.notEqual(cutoverMetricIndex, -1);
    assert.ok(runtimeMetricIndex < cutoverMetricIndex);
    assert.ok(runtimeMetricIndex < cutoverGuardIndex);
    assert.match(dispatch, /if \(runtimeMode === "cutover"\) \{\s*recordFieldExposureCutoverSelection/);
    assert.doesNotMatch(
      dispatch.slice(runtimeMetricIndex, cutoverGuardIndex),
      /if \(runtimeMode === "cutover"\)/,
    );
  });

  it("ships dispatch and metrics behavioral coverage for shadow and cutover jobs", () => {
    assert.equal(existsSync(DISPATCH_SPEC), true);
    assert.equal(existsSync(METRICS_SPEC), true);

    const dispatchSpec = readFileSync(DISPATCH_SPEC, "utf8");
    const metricsSpec = readFileSync(METRICS_SPEC, "utf8");

    assert.match(dispatchSpec, /records runtime selection observability for shadow profile-default jobs/);
    assert.match(
      dispatchSpec,
      /records runtime and compatibility cutover selection observability for cutover jobs/,
    );
    assert.match(dispatchSpec, /field_exposure_runtime_selection_total/);
    assert.match(dispatchSpec, /runtime_mode: "shadow"/);
    assert.match(dispatchSpec, /field_exposure_cutover_selection_total/);
    assert.match(metricsSpec, /records field exposure runtime selection metrics with mode labels/);
    assert.match(metricsSpec, /runtime_mode: "shadow"/);
    assert.match(metricsSpec, /native_intent_missing: "true"/);
  });
});
