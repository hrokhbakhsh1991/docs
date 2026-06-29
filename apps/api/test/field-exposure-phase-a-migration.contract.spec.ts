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
const DISPATCH_SPEC = join(
  REPO_ROOT,
  "apps/api/src/integrations/application/dispatch-integration-domain-event.spec.ts",
);
const PUBLIC_API_SPEC = join(
  REPO_ROOT,
  "packages/platform-core/test/unit/exposure/public-api.spec.ts",
);

describe("field exposure phase A migration contract", () => {
  it("documents Phase A exit criteria", () => {
    const text = readFileSync(EXPOSURE_DOC, "utf8");

    assert.match(text, /Phase A exit criteria/);
    assert.match(text, /FIELD_EXPOSURE_DECISION_ENGINE_SHADOW/);
    assert.match(text, /field-exposure-phase-a-migration\.contract\.spec\.ts/);
  });

  it("keeps forward shadow default-off and fail-open in dispatch", () => {
    const dispatch = readFileSync(DISPATCH, "utf8");

    assert.match(dispatch, /export function isFieldExposureDecisionEngineShadowEnabled/);
    assert.match(dispatch, /if \(!isFieldExposureDecisionEngineShadowEnabled\(\)\)/);
    assert.match(dispatch, /field_exposure_decision_engine\.shadow\.failed/);
    assert.match(dispatch, /if \(runtimeMode === "shadow"\)/);
  });

  it("covers payload stability and fail-open enqueue in dispatch specs", () => {
    const spec = readFileSync(DISPATCH_SPEC, "utf8");

    assert.match(spec, /deliverySelectionPayload\(shadowOnPayload\)/);
    assert.match(spec, /deliverySelectionPayload\(shadowOffPayload\)/);
    assert.match(spec, /shadow_failed/);
    assert.match(spec, /assert\.equal\(count, 1\)/);
  });

  it("exports exposure engine symbols from platform-core public API", () => {
    const spec = readFileSync(PUBLIC_API_SPEC, "utf8");

    assert.match(spec, /resolveFieldExposureDecision/);
    assert.match(spec, /normalizeIntegrationEventType/);
  });
});
