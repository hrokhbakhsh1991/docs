import { resolveThemeCompatibleCategories } from "@app-tour/workspace-denali";

import type { EquipmentResource, TourThemeResource } from "@/features/settings/settings-module-types";

export function isEquipmentCompatibleWithTourCategory(
  item: EquipmentResource,
  tourCategory: string | undefined
): boolean {
  if (item.category == null || item.category.trim().length === 0) {
    return true;
  }
  if (tourCategory == null || tourCategory.trim().length === 0) {
    return true;
  }
  return item.category === tourCategory;
}

function resolveThemeAllowedCategories(theme: TourThemeResource): readonly string[] {
  if (theme.compatibleCategories !== undefined && theme.compatibleCategories.length > 0) {
    return theme.compatibleCategories;
  }
  return resolveThemeCompatibleCategories(theme.formProfile);
}

export function isTourThemeCompatibleWithWizard(
  theme: TourThemeResource,
  tourCategory: string | undefined,
  workspaceFormProfile: string
): boolean {
  if (theme.formProfile == null || theme.formProfile.trim().length === 0) {
    return true;
  }
  if (theme.formProfile === workspaceFormProfile) {
    return true;
  }
  const allowed = resolveThemeAllowedCategories(theme);
  if (tourCategory == null || tourCategory.trim().length === 0) {
    return allowed.length === 0;
  }
  return allowed.includes(tourCategory);
}
