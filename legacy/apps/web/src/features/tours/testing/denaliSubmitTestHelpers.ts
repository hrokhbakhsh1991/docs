/**
 * Test / Node-script helpers — same submit gate as create-tour-from-wizard.
 * Not re-exported from validation or application barrels (avoids client bundles).
 */

import {
  buildDenaliTourCreateTestValues,
  normalizeDenaliWizardForm,
  type DenaliCreateTourWizardForm,
} from "@/features/tours/wizard/schemas/denaliTourCreateFormModel";

import { getDenaliWizardSubmitIssues } from "@/features/tours/wizard/denali/validation/denaliWizardFormZod";

function assertNoSubmitIssues(
  issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string }>,
): void {
  if (issues.length !== 0) {
    throw new Error(
      issues
        .map((i) => `${i.path.map(String).join(".")}: ${i.message}`)
        .join("; "),
    );
  }
}

/** Asserts production submit gate passes; returns normalized form (post-{@link normalizeDenaliWizardForm}). */
export function assertSubmitValidDenaliWizardForm(
  values: DenaliCreateTourWizardForm,
): DenaliCreateTourWizardForm {
  const normalized = normalizeDenaliWizardForm(values);
  const issues = getDenaliWizardSubmitIssues(normalized);
  assertNoSubmitIssues(issues);
  return normalized;
}

/** Defaults that pass {@link getDenaliWizardSubmitIssues} (mountain_day). */
export function submitValidDenaliWizardDefaults(): DenaliCreateTourWizardForm {
  return assertSubmitValidDenaliWizardForm(buildDenaliTourCreateTestValues());
}
