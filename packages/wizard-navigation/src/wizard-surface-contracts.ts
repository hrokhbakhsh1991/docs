/**
 * Shared wizard surface contracts — host + workspace packages must not fork these.
 * INV-DENALI-WIZ-017 / WEB-WIZ-017
 */

/** Composite widgets: step-nav / review invalid wiring. */
export type WizardCompositeA11yProps = {
  /** Step-nav / review issue targets this field — forward to primary control `aria-invalid`. */
  readonly invalid?: boolean;
  /**
   * Canonical paths from active step-nav / review issues.
   * Composites use this for dependents that are not the render-plan anchor path.
   */
  readonly validationIssuePaths?: readonly string[];
};

/**
 * Denali review i18n keys under `denali.review.*`.
 * Platform host may pass the same discriminant; workspaces map to their namespace.
 */
export type WizardValidationHeadingKey =
  | "review.stepValidationHeading"
  | "review.validationHeading";

export function resolveWizardValidationHeadingKey(
  key: WizardValidationHeadingKey | undefined
): WizardValidationHeadingKey {
  return key ?? "review.validationHeading";
}
