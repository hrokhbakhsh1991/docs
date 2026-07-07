import { resolveThemeCompatibleCategories } from "../../settings/theme-compatible-categories";
import { resolveEquipmentCompatibleCategories } from "../../settings/equipment-compatible-categories";
import { isEquipmentCompatibleWithTourThemes as isEquipmentThemeMatch } from "../../settings/equipment-compatible-themes";

import type { EquipmentResource, TourThemeResource } from "../adapters/catalog-types";

function resolveEquipmentAllowedCategories(item: EquipmentResource): readonly string[] {
  if (item.compatibleCategories !== undefined && item.compatibleCategories.length > 0) {
    return item.compatibleCategories;
  }
  return resolveEquipmentCompatibleCategories(item.category);
}

export function isEquipmentCompatibleWithTourCategory(
  item: EquipmentResource,
  tourCategory: string | undefined
): boolean {
  const allowed = resolveEquipmentAllowedCategories(item);
  if (allowed.length === 0) {
    return true;
  }
  if (tourCategory == null || tourCategory.trim().length === 0) {
    return true;
  }
  return allowed.includes(tourCategory);
}

export function isEquipmentVisibleInWizard(
  item: EquipmentResource,
  tourCategory: string | undefined,
  tourThemeIds: readonly string[] | undefined
): boolean {
  const themeIds = item.themeIds ?? [];
  if (themeIds.length > 0) {
    return isEquipmentThemeMatch(themeIds, tourThemeIds);
  }
  return isEquipmentCompatibleWithTourCategory(item, tourCategory);
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
