import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const REPO_ROOT = join(process.cwd(), "..", "..");
const EXPOSURE_DOC = join(REPO_ROOT, "docs/architecture/field-exposure-system.md");
const DISPATCH = join(
  REPO_ROOT,
  "apps/api/src/integrations/application/dispatch-integration-domain-event.ts",
);
const RUNTIME_MODE = join(REPO_ROOT, "apps/api/src/exposure/exposure-runtime-mode.ts");
const METRICS = join(REPO_ROOT, "apps/api/src/observability/metrics.ts");
const PHASE_6_CONTRACT = join(
  REPO_ROOT,
  "apps/api/test/field-exposure-phase-6-cutover.contract.spec.ts",
);

describe("field exposure phase 12 native intent metadata contract", () => {
  it("documents Phase 12 as mode-independent native intent metadata", () => {
    const text = readFileSync(EXPOSURE_DOC, "utf8");

    assert.match(text, /Unified Control Plane Migration — Phase 12/);
    assert.match(text, /nativeIntentMissing = true/);
    assert.match(text, /independent from `FIELD_EXPOSURE_RUNTIME_MODE`/);
    assert.match(text, /field-exposure-phase-12-native-intent-metadata\.contract\.spec\.ts/);
  });

  it("derives nativeIntentMissing from decision source, not cutover mode", () => {
    const dispatch = readFileSync(DISPATCH, "utf8");
    const assignmentStart = dispatch.indexOf("const nativeIntentMissing =");
    const assignmentEnd = dispatch.indexOf("const activeDeliveryFieldIds", assignmentStart);
    const assignment = dispatch.slice(assignmentStart, assignmentEnd);

    assert.match(assignment, /decision\.exposureIntent == null/);
    assert.match(assignment, /selectionSource === "exposure_profile_defaults"/);
    assert.doesNotMatch(assignment, /runtimeMode === "cutover"/);
    assert.match(dispatch, /nativeIntentMissing: exposureRuntime\.nativeIntentMissing/);
    assert.match(dispatch, /recordFieldExposureRuntimeSelection\(\{/);
    assert.doesNotMatch(
      dispatch.slice(
        dispatch.indexOf("recordFieldExposureRuntimeSelection({"),
        dispatch.indexOf("if (runtimeMode === \"cutover\")"),
      ),
      /runtimeMode === "cutover"/,
    );
  });

  it("documents profile-default semantics on runtime metadata and metrics", () => {
    const runtimeMode = readFileSync(RUNTIME_MODE, "utf8");
    const metrics = readFileSync(METRICS, "utf8");
    const phase6 = readFileSync(PHASE_6_CONTRACT, "utf8");

    assert.match(runtimeMode, /no native intent row was active and profile defaults drove the engine decision/);
    assert.doesNotMatch(runtimeMode, /cutover fell back/);
    assert.match(metrics, /native_intent_missing/);
    assert.match(phase6, /shadow mode uses profile defaults when no native intent exists/);
    assert.match(phase6, /fieldExposureRuntime\.nativeIntentMissing, true/);
    assert.match(phase6, /fieldExposureRuntime\.nativeIntentMissing, false/);
  });
});
