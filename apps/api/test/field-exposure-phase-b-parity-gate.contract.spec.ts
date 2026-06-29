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
const METRICS = join(REPO_ROOT, "apps/api/src/observability/metrics.ts");
const COMPARATOR = join(REPO_ROOT, "apps/api/src/exposure/compare-shadow-vs-legacy.ts");

describe("field exposure phase B parity gate contract", () => {
  it("documents observational-only Phase B exit criteria", () => {
    const text = readFileSync(EXPOSURE_DOC, "utf8");

    assert.match(text, /Phase B parity gate activation/);
    assert.match(text, /Phase B exit criteria/);
    assert.match(text, /observational only/);
    assert.match(text, /field_exposure\.shadow_parity_summary/);
    assert.match(text, /field_exposure_engine_shadow_mismatch_total/);
    assert.match(text, /mismatch rate must be triaged/);
  });

  it("logs aggregate parity summary and records bounded mismatch metric in dispatch shadow path", () => {
    const dispatch = readFileSync(DISPATCH, "utf8");

    assert.match(dispatch, /event: "field_exposure\.shadow_parity_summary"/);
    assert.match(dispatch, /matches: parityReport\.matches/);
    assert.match(dispatch, /mismatchCount: parityReport\.mismatchCount/);
    assert.match(dispatch, /fieldCount: parityReport\.fieldReports\.length/);
    assert.match(dispatch, /if \(parityReport\.mismatchCount > 0\)/);
    assert.match(dispatch, /recordFieldExposureEngineShadowMismatch/);
  });

  it("uses bounded tenant, event, and surface labels for the forward engine mismatch metric", () => {
    const metrics = readFileSync(METRICS, "utf8");
    const helperStart = metrics.indexOf("export function recordFieldExposureEngineShadowMismatch");
    const helperEnd = metrics.indexOf("/** Phase 9.10", helperStart);
    const helperSource = metrics.slice(helperStart, helperEnd);

    assert.match(helperSource, /field_exposure_engine_shadow_mismatch_total/);
    assert.match(helperSource, /tenant_id: input\.tenantId/);
    assert.match(helperSource, /event_type: input\.eventType/);
    assert.match(helperSource, /surface: input\.surface/);
    assert.doesNotMatch(helperSource, /workspace_type/);
    assert.doesNotMatch(helperSource, /provider:/);
  });

  it("defines comparator parity report shape used by the aggregate gate", () => {
    const comparator = readFileSync(COMPARATOR, "utf8");

    assert.match(comparator, /export type ShadowParityReport/);
    assert.match(comparator, /readonly matches: boolean/);
    assert.match(comparator, /readonly mismatchCount: number/);
    assert.match(comparator, /fieldReports\.sort/);
  });
});
