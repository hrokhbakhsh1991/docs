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
const ACTIVE_SELECTOR = join(REPO_ROOT, "apps/api/src/exposure/resolve-active-delivery-field-ids.ts");
const RESOLVER = join(REPO_ROOT, "apps/api/src/exposure/resolve-exposure-decision.ts");
const RUNTIME_MODE = join(REPO_ROOT, "apps/api/src/exposure/exposure-runtime-mode.ts");

describe("field exposure engine migration closure contract", () => {
  it("documents Phase E closure criteria", () => {
    const text = readFileSync(EXPOSURE_DOC, "utf8");

    assert.match(text, /Phase E closure criteria/);
    assert.match(text, /Cutover active selection is sourced from `engineSelectedFieldIds` only/);
    assert.match(text, /engineSelectorMissing=true/);
    assert.match(text, /full exposure catalog/);
  });

  it("keeps cutover active selection engine-owned with explicit missing-selector audit", () => {
    const selectorSource = readFileSync(ACTIVE_SELECTOR, "utf8");

    assert.match(selectorSource, /fieldExposureDecision\?\.engineSelectedFieldIds/);
    assert.match(selectorSource, /engineSelectorMissing: true/);
    assert.doesNotMatch(selectorSource, /engineSelectorFallback/);
    assert.doesNotMatch(selectorSource, /fieldIds: input\.legacyEligibleFieldIds/);
  });

  it("skips temporary forward shadow diagnostics in cutover mode", () => {
    const dispatch = readFileSync(DISPATCH, "utf8");

    assert.match(dispatch, /if \(runtimeMode === "shadow"\) \{/);
    assert.match(dispatch, /runShadow\(\{/);
    assert.match(dispatch, /field_exposure_decision_engine\.shadow\.failed/);
  });

  it("builds engine decisions from full catalog instead of deliverable selectable ids", () => {
    const builder = readFileSync(
      join(REPO_ROOT, "apps/api/src/exposure/build-field-exposure-engine-input.ts"),
      "utf8",
    );
    const dispatch = readFileSync(DISPATCH, "utf8");

    assert.match(builder, /buildExposureFieldCatalog\(input\.workspaceType\)/);
    assert.match(builder, /for \(const field of snapshot\.registryCatalog\)/);
    assert.doesNotMatch(builder, /exposureSelectableFieldIds/);
    assert.match(dispatch, /buildFieldExposureEngineDecisionMap/);
  });

  it("exposes engine-selected ids as resolver output, not compatibility delivery policy state", () => {
    const resolver = readFileSync(RESOLVER, "utf8");
    const runtimeMode = readFileSync(RUNTIME_MODE, "utf8");

    assert.match(resolver, /readonly engineSelectedFieldIds\?: readonly string\[\]/);
    assert.match(resolver, /resolveEngineSelectedFieldIds/);
    assert.match(runtimeMode, /readonly engineSelectorMissing\?: true/);
  });
});
