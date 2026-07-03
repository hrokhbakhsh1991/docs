import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertDenaliFrozenWizardTemplateFieldsPresent,
  DENALI_FROZEN_TEMPLATE_FIELDS,
  DENALI_TOUR_KIND_CANONICAL_PATH,
  DenaliWizardTemplateFrozenFieldMissingError,
  ensureDenaliFrozenAllowedPaths,
  ensureDenaliFrozenTemplateSteps,
  ensureDenaliMatrixRequiredAllowedPaths,
  ensureDenaliMatrixRequiredTemplateSteps,
  ensureDenaliTourKindAllowedPaths,
  ensureDenaliTourKindTemplateSteps,
  isDenaliFrozenTemplateCanonicalPath,
  listDenaliFrozenTemplateCanonicalPaths,
  normalizeDenaliWizardTemplatePayloadSteps,
} from "../src/wizard/ensure-tour-kind-template-field";

describe("ensure-tour-kind-template-field.spec.ts", () => {
  it("DEN-TK-TPL-01 injects frozen basic fields with category first when missing", () => {
    const steps = ensureDenaliFrozenTemplateSteps([
      {
        stepId: "denali_basic",
        enabled: true,
        fields: [{ canonicalPath: "leaderUserIds" }],
      },
    ]);

    assert.equal(steps[0]?.fields[0]?.canonicalPath, DENALI_TOUR_KIND_CANONICAL_PATH);
    assert.ok(steps[0]?.fields.some((field) => field.canonicalPath === "title"));
    assert.ok(steps[0]?.fields.some((field) => field.canonicalPath === "destinationId"));
  });

  it("DEN-TK-TPL-02 adds missing frozen photos and logistics steps when basic is complete", () => {
    const input = [
      {
        stepId: "denali_basic",
        enabled: true,
        fields: DENALI_FROZEN_TEMPLATE_FIELDS.denali_basic!.map((field) => ({
          canonicalPath: field.canonicalPath,
        })),
      },
    ];
    const steps = ensureDenaliFrozenTemplateSteps(input);
    assert.ok(steps.some((step) => step.stepId === "denali_photos"));
    assert.ok(steps.some((step) => step.stepId === "denali_logistics"));
  });

  it("DEN-TK-TPL-03 allowed paths include all frozen fields", () => {
    const frozen = listDenaliFrozenTemplateCanonicalPaths();
    assert.ok(frozen.includes("category"));
    assert.ok(frozen.includes("transport.mode"));
    const merged = ensureDenaliTourKindAllowedPaths(["title"]);
    assert.ok(merged.includes("title"));
    for (const path of frozen) {
      assert.ok(merged.includes(path));
    }
  });

  it("DEN-TK-TPL-04 injects program.themeIds on denali_photos when missing", () => {
    const steps = ensureDenaliFrozenTemplateSteps([
      {
        stepId: "denali_photos",
        enabled: true,
        fields: [{ canonicalPath: "leaderUserIds" }],
      },
    ]);
    const photosStep = steps.find((step) => step.stepId === "denali_photos");
    assert.ok(photosStep?.fields.some((field) => field.canonicalPath === "program.themeIds"));
    assert.ok(photosStep?.fields.some((field) => field.canonicalPath === "photos"));
  });

  it("DEN-TK-TPL-05 matrix still injects program.shortDescription when missing", () => {
    const steps = ensureDenaliMatrixRequiredTemplateSteps([
      {
        stepId: "denali_photos",
        enabled: true,
        fields: [{ canonicalPath: "photos" }],
      },
    ]);
    assert.equal(steps[0]?.fields[0]?.canonicalPath, "program.shortDescription");
  });

  it("DEN-TK-TPL-06 allowed paths include matrix-required shortDescription", () => {
    assert.deepEqual(ensureDenaliMatrixRequiredAllowedPaths(["photos"]), [
      "program.shortDescription",
      "photos",
    ]);
  });

  it("DEN-TK-FRZ-01 isDenaliFrozenTemplateCanonicalPath identifies frozen catalog fields", () => {
    assert.equal(isDenaliFrozenTemplateCanonicalPath("title"), true);
    assert.equal(isDenaliFrozenTemplateCanonicalPath("leaderUserIds"), false);
  });

  it("DEN-TK-FRZ-02 assertDenaliFrozenWizardTemplateFieldsPresent rejects stripped publish payload", () => {
    assert.throws(
      () =>
        assertDenaliFrozenWizardTemplateFieldsPresent({
          published: true,
          steps: [{ stepId: "denali_basic", enabled: true, fields: [{ canonicalPath: "title" }] }],
        }),
      DenaliWizardTemplateFrozenFieldMissingError
    );
  });

  it("DEN-TK-FRZ-03 normalizeDenaliWizardTemplatePayloadSteps injects frozen on publish", () => {
    const normalized = normalizeDenaliWizardTemplatePayloadSteps({
      published: true,
      steps: [{ stepId: "denali_basic", enabled: true, fields: [{ canonicalPath: "title" }] }],
    });
    assert.ok(
      normalized.steps?.some((step) =>
        step.fields.some((field) => field.canonicalPath === "category")
      )
    );
  });

  it("DEN-TK-FRZ-04 ensureDenaliFrozenAllowedPaths merges frozen paths", () => {
    const merged = ensureDenaliFrozenAllowedPaths(["title"]);
    for (const path of listDenaliFrozenTemplateCanonicalPaths()) {
      assert.ok(merged.includes(path));
    }
  });
});
