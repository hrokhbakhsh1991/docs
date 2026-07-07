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
const DELIVERY_DEFINITIONS = join(
  REPO_ROOT,
  "apps/api/src/integrations/application/delivery-field-definitions.ts",
);

describe("field exposure phase E cleanup contract", () => {
  it("documents Phase E closure criteria and engine-only cutover selectors", () => {
    const text = readFileSync(EXPOSURE_DOC, "utf8");

    assert.match(text, /Phase E closure criteria/);
    assert.match(text, /engineSelectedFieldIds` only/);
    assert.match(text, /field-exposure-phase-e-cleanup\.contract\.spec\.ts/);
    assert.match(text, /fieldExposureShadow/);
    assert.match(text, /exposureSelectableFieldIds/);
    assert.match(text, /resolveDeliveryFieldDefinitions/);
    assert.match(text, /delivery-field-definitions\.ts/);
    assert.match(text, /engineSelectorFallback/);
  });

  it("keeps cutover selection engine-owned without legacy fallback", () => {
    const selectorSource = readFileSync(ACTIVE_SELECTOR, "utf8");

    assert.match(selectorSource, /fieldExposureDecision\?\.engineSelectedFieldIds/);
    assert.match(selectorSource, /engineSelectorMissing: true/);
    assert.doesNotMatch(selectorSource, /engineSelectorFallback/);
    assert.doesNotMatch(selectorSource, /fieldIds: input\.legacyEligibleFieldIds/);
  });

  it("sources cutover compatibility payload keys from engine projections", () => {
    const dispatch = readFileSync(DISPATCH, "utf8");
    const payloadStart = dispatch.indexOf("function deliveryFieldPolicyPayload");
    const payloadEnd = dispatch.indexOf("/**", payloadStart);
    const payloadSource = dispatch.slice(payloadStart, payloadEnd);

    assert.doesNotMatch(payloadSource, /runtimeMode === "cutover"/);
    assert.match(payloadSource, /fieldExposureDecision\.candidateFieldIds/);
    assert.match(payloadSource, /integrationDeliveryFieldIds: activeFieldIds/);
  });

  it("skips legacy mirror shadow diagnostics in cutover mode", () => {
    const dispatch = readFileSync(DISPATCH, "utf8");

    assert.match(dispatch, /runtimeMode === "cutover"\s*\?\s*null\s*:\s*resolveFieldExposureShadowDiagnostics/);
    assert.match(dispatch, /if \(runtimeMode === "shadow"\) \{/);
  });

  it("projects engine catalog candidates without deliverable-tag filtering when engine decisions exist", () => {
    const resolver = readFileSync(RESOLVER, "utf8");
    const dispatch = readFileSync(DISPATCH, "utf8");

    assert.match(resolver, /resolveEngineCandidateFieldIds/);
    assert.match(resolver, /const engineCandidateFieldIds = resolveEngineCandidateFieldIds/);
    assert.doesNotMatch(dispatch, /useEngineCatalogForCandidates: runtimeMode === "cutover"/);
  });

  it("uses definitions-only delivery policy adaptation in cutover resolver path", () => {
    const resolver = readFileSync(RESOLVER, "utf8");
    const deliveryDefinitions = readFileSync(DELIVERY_DEFINITIONS, "utf8");

    assert.match(resolver, /resolveDeliveryFieldDefinitions/);
    assert.match(resolver, /const definitions =\s*resolveDefinitions/);
    assert.match(deliveryDefinitions, /resolveDeliveryFieldDefinitions/);
    assert.match(deliveryDefinitions, /exposureCatalogFieldIds/);
    assert.doesNotMatch(deliveryDefinitions, /export function resolveDeliveryFieldPolicy/);
    assert.doesNotMatch(resolver, /resolveDeliveryFieldPolicy\(/);
    assert.doesNotMatch(resolver, /resolve-delivery-field-policy/);
  });
});
