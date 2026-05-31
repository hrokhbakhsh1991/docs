export type {
  FieldRule,
  FieldRequiredness,
  FieldVisibility,
  ProfileMeta,
  ProfileRules,
  StepRule,
  StepRules,
  ValidationLevel,
  WizardFieldPath,
} from "./types";

/**
 * Re-export of the canonical domain alias so wizard call sites can spell the type
 * with the intent name without having to import directly from `@repo/types`. Under
 * the hood this is the same closed set as `TourFormProfile`.
 *
 * @see packages/types/src/tour-domain-profile.ts
 */
export type { TourDomainProfile } from "@repo/types";

export {
  getFieldRule,
  getInactiveFieldGroups,
  getInactiveRootKeys,
  getProfileRules,
  getStepRule,
  getStepRules,
  getVisibleStepIds,
  isFieldRecommended,
  isFieldRequiredAtLevel,
  isFieldVisible,
  listAllProfileRules,
} from "./getProfileRules";

export { ALL_PROFILES } from "./rules";

export {
  requiredFieldsForProfile,
  requiredFieldsForStep,
  validateForAutosave,
  validateForStepNavigation,
  validateForSubmit,
  visibleStepIdsForProfile,
  type ValidationIssue,
  type ValidationIssueCode,
  type ValidationResult,
} from "./validation";
