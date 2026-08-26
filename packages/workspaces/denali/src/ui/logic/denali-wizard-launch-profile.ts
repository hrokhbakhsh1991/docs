import {
  DENALI_TOUR_CATEGORY_VALUES,
  type DenaliTourCategorySlug,
} from "./denali-tour-kind-labels";

/**
 * First-launch Denali wizard — mountaineering/outdoor categories only.
 * Event types (reading/cinema) stay in architecture but are config-hidden for launch.
 */
export const DENALI_LAUNCH_WIZARD_CATEGORY_SLUGS = [
  "mountain",
  "nature",
  "desert",
] as const satisfies readonly DenaliTourCategorySlug[];

const LAUNCH_CATEGORY_SET = new Set<string>(DENALI_LAUNCH_WIZARD_CATEGORY_SLUGS);

export function resolveDenaliWizardCategoryChoices(): readonly DenaliTourCategorySlug[] {
  return DENALI_LAUNCH_WIZARD_CATEGORY_SLUGS;
}

export function resolveDenaliLaunchTourListFilterGroupIds(): readonly DenaliTourCategorySlug[] {
  return DENALI_LAUNCH_WIZARD_CATEGORY_SLUGS;
}

/** Existing tours with hidden categories remain valid; only creation UI is filtered. */
export function isDenaliLaunchWizardCategoryVisible(
  category: DenaliTourCategorySlug
): boolean {
  return LAUNCH_CATEGORY_SET.has(category);
}

export function listDenaliLaunchHiddenWizardCategories(): readonly DenaliTourCategorySlug[] {
  return DENALI_TOUR_CATEGORY_VALUES.filter(
    (category) => !isDenaliLaunchWizardCategoryVisible(category)
  );
}
