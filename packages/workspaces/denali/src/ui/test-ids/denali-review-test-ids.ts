export const DENALI_REVIEW_STEP_TEST_IDS = {
  panel: "denali-review-step",
  hero: "denali-review-hero",
  title: "denali-review-title",
  destinationName: "denali-review-destination-name",
  section: (stepId: string) => `denali-review-section-${stepId}`,
} as const;

export const DENALI_REVIEW_VALIDATION_TEST_IDS = {
  panel: "denali-review-validation-summary",
  stepGroup: "denali-validation-step-group",
  issueLink: "denali-validation-issue-link",
} as const;

export const DENALI_CONTENT_QUALITY_TEST_IDS = {
  header: "denali-wizard-content-quality-header",
  meter: "denali-wizard-content-quality-meter",
  label: "denali-wizard-content-quality-label",
} as const;
