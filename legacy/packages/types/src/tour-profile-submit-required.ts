import { getTourFormProfileDescriptor, type WizardFieldGroupSlug } from "./tour-form-profile-descriptors";
import type { TourFormProfile } from "./tour-form-profile";

/**
 * Wizard dotted paths that may be required at submit level (see web `BASE_FIELD_RULES`).
 * Profile-aware visibility is derived from {@link getTourFormProfileDescriptor}.
 */
export const WIZARD_SUBMIT_REQUIRED_FIELD_PATHS = [
  "overview.title",
  "pricing.basePrice",
  "itinerary.days",
  "logistics.primaryTransportMode",
] as const;

export type WizardSubmitRequiredFieldPath = (typeof WIZARD_SUBMIT_REQUIRED_FIELD_PATHS)[number];

/** Wizard step ids for the four submit-required fields (parity with web `stepConfig`). */
export type WizardSubmitRequiredStepId =
  | "basic"
  | "capacity"
  | "itinerary"
  | "logistics";

type SubmitRequiredFieldMeta = {
  readonly path: WizardSubmitRequiredFieldPath;
  readonly belongsToStep: WizardSubmitRequiredStepId;
  readonly belongsToGroup: WizardFieldGroupSlug;
};

/**
 * Metadata for submit-required fields only — not the full wizard field registry.
 * Parity with `apps/web/.../profileRules/rules.ts` rows marked `required: "required"`.
 */
const SUBMIT_REQUIRED_FIELD_META: readonly SubmitRequiredFieldMeta[] = [
  { path: "overview.title", belongsToStep: "basic", belongsToGroup: "basic_info" },
  { path: "pricing.basePrice", belongsToStep: "capacity", belongsToGroup: "pricing_capacity" },
  { path: "itinerary.days", belongsToStep: "itinerary", belongsToGroup: "itinerary" },
  {
    path: "logistics.primaryTransportMode",
    belongsToStep: "logistics",
    belongsToGroup: "logistics",
  },
] as const;

const STEP_PRIMARY_FIELD_GROUP: Record<
  WizardSubmitRequiredStepId,
  WizardFieldGroupSlug
> = {
  basic: "basic_info",
  capacity: "pricing_capacity",
  itinerary: "itinerary",
  logistics: "logistics",
};

function inactiveGroupSet(profile: TourFormProfile): ReadonlySet<WizardFieldGroupSlug> {
  return new Set(getTourFormProfileDescriptor(profile).inactiveFieldGroups);
}

/**
 * Mirrors web `isWizardStepRedundantForProfile` for the capacity step (urban/cinema).
 */
function isCapacityStepRedundant(profile: TourFormProfile): boolean {
  return getTourFormProfileDescriptor(profile).wizardCapacityStepRedundant;
}

function isStepHiddenForProfile(
  profile: TourFormProfile,
  stepId: WizardSubmitRequiredStepId,
): boolean {
  const primary = STEP_PRIMARY_FIELD_GROUP[stepId];
  if (inactiveGroupSet(profile).has(primary)) {
    return true;
  }
  if (stepId === "capacity" && isCapacityStepRedundant(profile)) {
    return true;
  }
  return false;
}

/**
 * True when a submit-required path is enforced for `profile` at submit level.
 * Algorithm parity: web `isFieldRequiredAtLevel(profile, path, "submit")` for paths in
 * {@link WIZARD_SUBMIT_REQUIRED_FIELD_PATHS}.
 */
export function isWizardSubmitFieldRequiredForProfile(
  profile: TourFormProfile,
  path: WizardSubmitRequiredFieldPath,
): boolean {
  const meta = SUBMIT_REQUIRED_FIELD_META.find((row) => row.path === path);
  if (!meta) {
    return false;
  }
  if (inactiveGroupSet(profile).has(meta.belongsToGroup)) {
    return false;
  }
  if (isStepHiddenForProfile(profile, meta.belongsToStep)) {
    return false;
  }
  return true;
}

/**
 * Ordered list of wizard paths required at submit for the given profile.
 * Used by API `assertProfileRequiredFieldsForSubmit` and web parity tests.
 */
export function getRequiredSubmitFieldPathsForProfile(
  profile: TourFormProfile,
): readonly WizardSubmitRequiredFieldPath[] {
  return WIZARD_SUBMIT_REQUIRED_FIELD_PATHS.filter((path) =>
    isWizardSubmitFieldRequiredForProfile(profile, path),
  );
}
