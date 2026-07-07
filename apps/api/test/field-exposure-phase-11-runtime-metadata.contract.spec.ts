import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const REPO_ROOT = join(process.cwd(), "..", "..");
const EXPOSURE_DOC = join(REPO_ROOT, "docs/architecture/field-exposure-system.md");
const ACTIVE_SELECTOR = join(REPO_ROOT, "apps/api/src/exposure/resolve-active-delivery-field-ids.ts");
const SELECTOR_PARITY = join(REPO_ROOT, "apps/api/src/exposure/resolve-exposure-selector-parity.ts");
const TRIAGE = join(REPO_ROOT, "apps/api/src/exposure/shadow-parity-intentional-mismatch.ts");
const DISPATCH = join(
  REPO_ROOT,
  "apps/api/src/integrations/application/dispatch-integration-domain-event.ts",
);

describe("field exposure phase 11 runtime metadata contract", () => {
  it("documents Phase 11 as runtime metadata decoupling from selector authority", () => {
    const text = readFileSync(EXPOSURE_DOC, "utf8");

    assert.match(text, /Unified Control Plane Migration — Phase 11/);
    assert.match(text, /integrationDeliveryCandidateFieldIds = fieldExposureDecision\.candidateFieldIds/);
    assert.match(text, /field-exposure-phase-11-runtime-metadata\.contract\.spec\.ts/);
    assert.match(text, /accepted-scope state/);
  });

  it("removes accepted cutover scope metadata from the active selector helper", () => {
    const selectorSource = readFileSync(ACTIVE_SELECTOR, "utf8");

    assert.match(selectorSource, /engineSelectedFieldIds/);
    assert.doesNotMatch(selectorSource, /acceptedCutoverScope/);
    assert.doesNotMatch(selectorSource, /ACCEPTED_ENGINE_CUTOVER_SCOPES/);
    assert.doesNotMatch(selectorSource, /isAcceptedEngineCutoverScope/);
    assert.equal(
      existsSync(join(REPO_ROOT, "apps/api/src/exposure/accepted-engine-cutover-scope.ts")),
      false,
    );
  });

  it("projects compatibility candidate ids from engine decisions in every runtime mode", () => {
    const dispatch = readFileSync(DISPATCH, "utf8");
    const payloadStart = dispatch.indexOf("function deliveryFieldPolicyPayload");
    const payloadEnd = dispatch.indexOf("/**", payloadStart);
    const payloadSource = dispatch.slice(payloadStart, payloadEnd);

    assert.match(payloadSource, /fieldExposureDecision\.candidateFieldIds/);
    assert.match(payloadSource, /integrationDeliveryCandidateFieldIds: compatibilityCandidateFieldIds/);
    assert.doesNotMatch(payloadSource, /runtimeMode === "cutover"/);
  });

  it("keeps selector parity and intentional mismatch triage diagnostics-only", () => {
    const dispatch = readFileSync(DISPATCH, "utf8");
    const selectorParity = readFileSync(SELECTOR_PARITY, "utf8");
    const triage = readFileSync(TRIAGE, "utf8");

    assert.match(selectorParity, /resolveExposureSelectorParity/);
    assert.doesNotMatch(selectorParity, /acceptedCutoverScope/);
    assert.match(triage, /FIELD_EXPOSURE_INTENTIONAL_SHADOW_PARITY_MISMATCHES/);
    assert.match(dispatch, /field_exposure\.selector_parity/);
    assert.match(dispatch, /adjustShadowParityForIntentionalMismatches/);
    assert.doesNotMatch(
      dispatch.slice(
        dispatch.indexOf('event: "field_exposure.selector_parity"'),
        dispatch.indexOf("if (shadowExposure !== null"),
      ),
      /acceptedCutoverScope/,
    );
  });
});
