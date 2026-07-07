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
const ACTIVE_SELECTOR = join(REPO_ROOT, "apps/api/src/exposure/resolve-active-delivery-field-ids.ts");
const RESOLVER = join(REPO_ROOT, "apps/api/src/exposure/resolve-exposure-decision.ts");
const TRIAGE = join(REPO_ROOT, "apps/api/src/exposure/shadow-parity-intentional-mismatch.ts");
const ENRICH = join(
  REPO_ROOT,
  "apps/api/src/integrations/application/enrich-canonical-delivery-payload.ts",
);

describe("field exposure phase D selector contract", () => {
  it("documents Phase D exit criteria and selector switch behavior", () => {
    const text = readFileSync(EXPOSURE_DOC, "utf8");

    assert.match(text, /Phase D exit criteria/);
    assert.match(text, /engineSelectedFieldIds/);
    assert.match(text, /FIELD_EXPOSURE_RUNTIME_MODE=shadow/);
    assert.match(text, /shadow-parity-intentional-mismatch\.ts/);
    assert.match(text, /field-exposure-phase-d-selector\.contract\.spec\.ts/);
  });

  it("projects engine-selected ids as the active selector source", () => {
    const resolver = readFileSync(RESOLVER, "utf8");
    const selectorSource = readFileSync(ACTIVE_SELECTOR, "utf8");

    assert.match(resolver, /resolveEngineSelectedFieldIds/);
    assert.match(resolver, /readonly engineSelectedFieldIds\?: readonly string\[\]/);
    assert.match(selectorSource, /fieldExposureDecision\?\.engineSelectedFieldIds/);
    assert.doesNotMatch(selectorSource, /fieldIds: input\.legacyEligibleFieldIds/);
  });

  it("feeds enrichment from the active selector ids", () => {
    const dispatch = readFileSync(DISPATCH, "utf8");
    const enrich = readFileSync(ENRICH, "utf8");

    assert.match(dispatch, /eligibleFieldIds: activeDeliveryFieldIds\.fieldIds/);
    assert.match(enrich, /eligibleFieldIds: readonly string\[\]/);
    assert.match(dispatch, /integrationDeliveryFieldIds: activeFieldIds/);
  });

  it("keeps intentional mismatch triage diagnostics-only", () => {
    assert.equal(existsSync(TRIAGE), true);

    const triage = readFileSync(TRIAGE, "utf8");
    const selectorSource = readFileSync(ACTIVE_SELECTOR, "utf8");

    assert.match(triage, /FIELD_EXPOSURE_INTENTIONAL_SHADOW_PARITY_MISMATCHES/);
    assert.doesNotMatch(triage, /ACCEPTED_ENGINE_CUTOVER_SCOPES/);
    assert.doesNotMatch(triage, /isAcceptedEngineCutoverScope/);
    assert.doesNotMatch(selectorSource, /acceptedCutoverScope/);
    assert.doesNotMatch(selectorSource, /isAcceptedEngineCutoverScope/);
  });

  it("builds engine decisions for audit metadata outside cutover-only paths", () => {
    const dispatch = readFileSync(DISPATCH, "utf8");
    const triage = readFileSync(TRIAGE, "utf8");

    assert.match(dispatch, /const engineDecisions =/);
    assert.match(dispatch, /workspaceType === null/);
    assert.doesNotMatch(
      dispatch.slice(dispatch.indexOf("const engineDecisions ="), dispatch.indexOf("const resolvedExposure =")),
      /runtimeMode !== "cutover"/,
    );
    assert.match(triage, /adjustShadowParityForIntentionalMismatches/);
    assert.match(dispatch, /adjustShadowParityForIntentionalMismatches/);
  });
});
