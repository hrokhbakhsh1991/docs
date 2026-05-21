/**
 * Test helpers — same submit gate as {@link createTourFromDenaliWizardForm}.
 */

import assert from "node:assert/strict";

import {
  buildDenaliTourCreateTestValues,
  normalizeDenaliWizardForm,
  type DenaliCreateTourWizardForm,
} from "@/features/tours/wizard/schemas/denaliTourCreateFormModel";

import { getDenaliWizardSubmitIssues } from "./denaliWizardFormZod";

/** Asserts production submit gate passes; returns normalized form (post-{@link normalizeDenaliWizardForm}). */
export function assertSubmitValidDenaliWizardForm(
  values: DenaliCreateTourWizardForm,
): DenaliCreateTourWizardForm {
  const normalized = normalizeDenaliWizardForm(values);
  const issues = getDenaliWizardSubmitIssues(normalized);
  assert.equal(
    issues.length,
    0,
    issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
  );
  return normalized;
}

/** Defaults that pass {@link getDenaliWizardSubmitIssues} (mountain_day). */
export function submitValidDenaliWizardDefaults(): DenaliCreateTourWizardForm {
  return assertSubmitValidDenaliWizardForm(buildDenaliTourCreateTestValues());
}
