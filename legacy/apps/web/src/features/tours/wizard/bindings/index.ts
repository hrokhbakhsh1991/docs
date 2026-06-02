import type { TourFormProfile } from "@repo/types";

import { getWizardConfig } from "@/features/tours/wizard/workspace-wizard.config";
import type { LayoutBindings } from "@/features/tours/wizard/shell/layout";

import { denaliBindings } from "./denali";

const classicBindings: LayoutBindings = {
  buildStepRail: () => ({
    stepIds: [],
    enableRailTestingOverrides: false,
    resolveVisibleSteps: () => [],
  }),
  buildStepComponentMap: () => ({}),
  buildGearCatalogFilter: (profile, overrides) =>
    denaliBindings.buildGearCatalogFilter(profile, overrides),
  hiddenFieldEviction: { collectHiddenFormPaths: () => [] },
};

export function resolveBindings(profile: TourFormProfile): LayoutBindings {
  if (getWizardConfig(profile).wizardMode === "denali") {
    return denaliBindings;
  }
  return classicBindings;
}

export { denaliBindings } from "./denali";
