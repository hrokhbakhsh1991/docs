/**
 * Phase 11.7 — Denali wizard client validation
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getDenaliWorkspacePlugin } from "@app-tour/workspace-denali";
import { mapValidationResultToIssues } from "@app-tour/wizard-navigation";

import {
  buildFieldStepResolverFromTemplate,
  validateDenaliWizardDraftSync,
} from "../src/wizard/denali/denali-wizard-validation";
import { groupValidationIssuesByStep } from "../src/wizard/denali/group-validation-issues-by-step";
import { emptyTourWizardDraft } from "../src/tours/tour-wizard-draft";

describe("denali-wizard-validation.spec.ts — Phase 11.7", () => {
  it("WEB-P11-7-01 empty draft fails validateCanonical", () => {
    const plugin = getDenaliWorkspacePlugin();
    const result = validateDenaliWizardDraftSync(
      plugin,
      emptyTourWizardDraft(),
      null,
      "00000000-0000-4000-8000-000000000014"
    );
    assert.equal(result.ok, false);
    assert.ok(result.violations.length > 0);
  });

  it("WEB-P11-7-02 template resolver maps canonical path to step", () => {
    const resolveStepId = buildFieldStepResolverFromTemplate([
      {
        stepId: "denali_basic",
        enabled: true,
        fields: [{ canonicalPath: "title" }],
      },
      {
        stepId: "review",
        enabled: true,
        fields: [{ canonicalPath: "publishStatus" }],
      },
    ]);
    assert.equal(resolveStepId("title"), "denali_basic");
    assert.equal(resolveStepId("publishStatus"), "review");
  });

  it("WEB-P11-7-03 groupValidationIssuesByStep preserves template order", () => {
    const issues = mapValidationResultToIssues(
      {
        ok: false,
        violations: [
          { code: "REQUIRED", fieldId: "title", message: "Title required" },
          { code: "REQUIRED", fieldId: "publishStatus", message: "Publish required" },
        ],
      },
      {
        resolveStepId: (fieldId) =>
          fieldId === "title" ? "denali_basic" : fieldId === "publishStatus" ? "review" : undefined,
      }
    );
    const groups = groupValidationIssuesByStep(issues, [
      { stepId: "denali_basic", label: "Basic" },
      { stepId: "review", label: "Review" },
    ]);
    assert.equal(groups.length, 2);
    assert.equal(groups[0]?.stepId, "denali_basic");
    assert.equal(groups[1]?.stepId, "review");
  });
});
