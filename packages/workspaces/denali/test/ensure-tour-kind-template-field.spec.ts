import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DENALI_TOUR_KIND_CANONICAL_PATH,
  ensureDenaliMatrixRequiredAllowedPaths,
  ensureDenaliMatrixRequiredTemplateSteps,
  ensureDenaliTourKindAllowedPaths,
  ensureDenaliTourKindTemplateSteps,
} from "../src/wizard/ensure-tour-kind-template-field";

describe("ensure-tour-kind-template-field.spec.ts", () => {
  it("DEN-TK-TPL-01 injects category first on denali_basic when missing", () => {
    const steps = ensureDenaliTourKindTemplateSteps([
      {
        stepId: "denali_basic",
        enabled: true,
        fields: [{ canonicalPath: "title", required: true }],
      },
    ]);

    assert.equal(steps[0]?.fields[0]?.canonicalPath, DENALI_TOUR_KIND_CANONICAL_PATH);
    assert.equal(steps[0]?.fields[1]?.canonicalPath, "title");
  });

  it("DEN-TK-TPL-02 no-op when category already visible", () => {
    const input = [
      {
        stepId: "denali_basic",
        enabled: true,
        fields: [{ canonicalPath: "category" }, { canonicalPath: "title" }],
      },
    ];
    const steps = ensureDenaliTourKindTemplateSteps(input);
    assert.deepEqual(steps, input);
  });

  it("DEN-TK-TPL-03 allowed paths include category", () => {
    assert.deepEqual(ensureDenaliTourKindAllowedPaths(["title"]), ["category", "title"]);
    assert.deepEqual(ensureDenaliTourKindAllowedPaths(["category", "title"]), [
      "category",
      "title",
    ]);
  });

  it("DEN-TK-TPL-04 injects program.shortDescription on denali_photos when missing", () => {
    const steps = ensureDenaliMatrixRequiredTemplateSteps([
      {
        stepId: "denali_photos",
        enabled: true,
        fields: [{ canonicalPath: "photos" }],
      },
    ]);
    assert.equal(steps[0]?.fields[0]?.canonicalPath, "program.shortDescription");
    assert.equal(steps[0]?.fields[1]?.canonicalPath, "photos");
  });

  it("DEN-TK-TPL-05 allowed paths include matrix-required shortDescription", () => {
    assert.deepEqual(ensureDenaliMatrixRequiredAllowedPaths(["photos"]), [
      "program.shortDescription",
      "photos",
    ]);
  });
});
