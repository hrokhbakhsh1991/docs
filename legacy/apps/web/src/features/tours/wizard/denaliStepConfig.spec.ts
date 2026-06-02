import assert from "node:assert/strict";
import test from "node:test";

import { buildDenaliTourCreateTestValues } from "@/features/tours/wizard/schemas/denaliTourCreateFormModel";
import { getDenaliWizardStepIssues } from "@/features/tours/wizard/schemas/denaliTourCreateValidation";
import {
  denaliWizardSteps,
  getDenaliWizardSteps,
} from "./denaliStepConfig";

import { DENALI_FIELD_DEFINITIONS } from "@repo/denali-domain";

test("denaliStepRelocation: rail order matches phase 3 layout", () => {
  assert.deepEqual(getDenaliWizardSteps(), [
    "denali_basic",
    "denali_photos",
    "denali_program",
    "denali_logistics",
    "denali_pricing",
    "denali_legal",
    "review",
  ]);
  assert.deepEqual([...denaliWizardSteps], getDenaliWizardSteps());
});

test("denaliStepRelocation: content fields registry stepId is denali_photos", () => {
  const contentPaths = ["program.themeIds", "program.shortDescription", "program.longDescription"];
  for (const canonicalPath of contentPaths) {
    const def = DENALI_FIELD_DEFINITIONS.find((field) => field.canonicalPath === canonicalPath);
    assert.ok(def, `missing registry entry for ${canonicalPath}`);
    assert.equal(
      def!.stepId,
      "denali_photos",
      `${canonicalPath} should belong to photos step after relocation`,
    );
  }
});

test("denaliStepRelocation: shortDescription issues surface on denali_photos not denali_program", () => {
  const form = buildDenaliTourCreateTestValues();
  form.basicInfo.tourType = "mountain_day";
  form.programNature.shortDescription = "";

  const photosIssues = getDenaliWizardStepIssues(form, "denali_photos").filter((issue) =>
    issue.path.join(".").includes("shortDescription"),
  );
  const programIssues = getDenaliWizardStepIssues(form, "denali_program").filter((issue) =>
    issue.path.join(".").includes("shortDescription"),
  );

  assert.ok(photosIssues.length > 0, "photos step should own shortDescription validation");
  assert.equal(programIssues.length, 0, "program step should not report shortDescription issues");
});

test("denaliStepRelocation: policies registry stepId is denali_legal", () => {
  const policyPaths = [
    "policies.policiesText",
    "policies.cancellationDeadlineHours",
    "policies.cancellationPenaltyPercentage",
  ] as const;
  for (const canonicalPath of policyPaths) {
    const def = DENALI_FIELD_DEFINITIONS.find((field) => field.canonicalPath === canonicalPath);
    assert.ok(def, `missing registry entry for ${canonicalPath}`);
    assert.equal(def!.stepId, "denali_legal", `${canonicalPath} should belong to legal step`);
  }
});

test("denaliStepRelocation: policy fields are not scoped to denali_pricing step validation", () => {
  const form = buildDenaliTourCreateTestValues();
  form.basicInfo.tourType = "mountain_day";
  form.policies.policiesText = "";

  const legalIssues = getDenaliWizardStepIssues(form, "denali_legal").filter((issue) =>
    issue.path.join(".").includes("policies"),
  );
  const pricingIssues = getDenaliWizardStepIssues(form, "denali_pricing").filter((issue) =>
    issue.path.join(".").includes("policies"),
  );

  assert.equal(pricingIssues.length, 0, "pricing step should not own policies.* issues");
  assert.equal(legalIssues.length, 0, "optional policiesText empty should not block legal step");
});

test("denaliStepRelocation: itinerary fields stay on denali_program", () => {
  const itineraryDef = DENALI_FIELD_DEFINITIONS.find(
    (field) => field.canonicalPath === "program.itinerary",
  );
  assert.ok(itineraryDef);
  assert.equal(itineraryDef!.stepId, "denali_program");
});
