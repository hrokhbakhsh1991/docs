import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const REPO_ROOT = join(process.cwd(), "..", "..");
const EXPOSURE_DOC = join(REPO_ROOT, "docs/architecture/field-exposure-system.md");
const ENGINE = join(
  REPO_ROOT,
  "packages/platform-core/src/exposure/field-exposure-decision-engine.ts",
);
const ENGINE_TYPES = join(REPO_ROOT, "packages/platform-core/src/exposure/types.ts");
const BUILDER = join(REPO_ROOT, "apps/api/src/exposure/build-field-exposure-engine-input.ts");
const DISPATCH = join(
  REPO_ROOT,
  "apps/api/src/integrations/application/dispatch-integration-domain-event.ts",
);
const ACTIVE_SELECTOR = join(REPO_ROOT, "apps/api/src/exposure/resolve-active-delivery-field-ids.ts");
const ENGINE_SPEC = join(
  REPO_ROOT,
  "packages/platform-core/test/unit/exposure/field-exposure-decision-engine.spec.ts",
);

describe("field exposure phase C engine contract", () => {
  it("documents Phase C exit criteria and non-authoritative intent behavior", () => {
    const text = readFileSync(EXPOSURE_DOC, "utf8");

    assert.match(text, /Phase C exit criteria/);
    assert.match(text, /build-field-exposure-engine-input\.ts/);
    assert.match(text, /override_fields/);
    assert.match(text, /field-exposure-phase-c-engine\.contract\.spec\.ts/);
  });

  it("enforces registry, FieldPolicy, ExposurePolicy, and ExposureIntent lower bounds in platform-core", () => {
    const engine = readFileSync(ENGINE, "utf8");
    const types = readFileSync(ENGINE_TYPES, "utf8");
    const spec = readFileSync(ENGINE_SPEC, "utf8");

    assert.match(engine, /registry_check:missing/);
    assert.match(engine, /fieldState\.state === "hidden"/);
    assert.match(engine, /exposure_policy_check:not_allowed/);
    assert.match(engine, /exposure_intent:disabled/);
    assert.match(engine, /exposure_intent_override:not_selected/);
    assert.match(types, /exposurePolicy\?:/);
    assert.match(types, /allowedFieldIds: readonly string\[\]/);
    assert.match(spec, /hides fields outside the exposure policy allowedFieldIds snapshot/);
    assert.match(spec, /enforces FieldPolicy hidden as a hard lower bound/);
  });

  it("centralizes engine snapshot construction in the API adapter", () => {
    assert.equal(existsSync(BUILDER), true);

    const builder = readFileSync(BUILDER, "utf8");
    const dispatch = readFileSync(DISPATCH, "utf8");

    assert.match(builder, /buildFieldExposureEngineInputSnapshot/);
    assert.match(builder, /buildFieldExposureEngineDecisionMap/);
    assert.match(builder, /audience: input\.audience \?\? FIELD_EXPOSURE_RUNTIME_AUDIENCE/);
    assert.match(builder, /mapExposureIntentForEngine/);
    assert.match(builder, /mapExposurePolicyForEngine/);
    assert.match(dispatch, /buildFieldExposureEngineDecisionMap/);
    assert.match(dispatch, /buildFieldExposureEngineInputSnapshot/);
    assert.match(dispatch, /exposureIntent: decision\.exposureIntent/);
    assert.match(dispatch, /exposureProfile: profile/);
    assert.doesNotMatch(dispatch, /adaptWorkspaceFieldPolicyManifest/);
  });

  it("records engine audit metadata and keeps active selector engine-owned", () => {
    const dispatch = readFileSync(DISPATCH, "utf8");
    const activeSelector = readFileSync(ACTIVE_SELECTOR, "utf8");
    const resolver = readFileSync(
      join(REPO_ROOT, "apps/api/src/exposure/resolve-exposure-decision.ts"),
      "utf8",
    );

    assert.match(resolver, /engineSelectedFieldIds/);
    assert.match(dispatch, /engineDecisions,/);
    assert.match(dispatch, /engineSelectedFieldIds/);
    assert.match(activeSelector, /fieldExposureDecision\?\.engineSelectedFieldIds/);
    assert.doesNotMatch(activeSelector, /runtimeMode/);
  });
});
