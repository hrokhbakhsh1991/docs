import { resolveTourListCategorySurface } from "@/bootstrap/workspace-tour-list-category-bindings.generated";

import type { TourListCategoryFilterGroup } from "./tour-list-category-surface-types";

export const TOUR_CATEGORY_FILTER_ALL = "all" as const;

export type TourCategoryFilter =
  | typeof TOUR_CATEGORY_FILTER_ALL
  | (string & {});

export type { TourListCategoryFilterGroup as TourCategoryFilterGroup };

function requireTourListCategorySurface(pluginId: string) {
  const surface = resolveTourListCategorySurface(pluginId);
  if (surface == null) {
    throw new Error(`No tour list category surface for plugin: ${pluginId}`);
  }
  return surface;
}

export function tourCategoryFilterOptionsForPlugin(
  pluginId: string
): readonly (typeof TOUR_CATEGORY_FILTER_ALL | string)[] {
  const surface = requireTourListCategorySurface(pluginId);
  return [TOUR_CATEGORY_FILTER_ALL, ...surface.tourKindValues];
}

export function tourCategoryFilterGroupsForPlugin(
  pluginId: string
): readonly TourListCategoryFilterGroup[] {
  return requireTourListCategorySurface(pluginId).filterGroups;
}

export function isTourKindSlug(pluginId: string, value: string | null): boolean {
  const surface = resolveTourListCategorySurface(pluginId);
  if (surface == null) {
    return false;
  }
  return surface.isTourKindSlug(value);
}

export function isTourCategoryGroup(pluginId: string, value: string): boolean {
  const surface = resolveTourListCategorySurface(pluginId);
  if (surface == null) {
    return false;
  }
  return surface.isTourCategoryGroup(value);
}

export function resolveTourKindDuration(
  pluginId: string,
  category: string | null
): "single_day" | "multi_day" | null {
  const surface = resolveTourListCategorySurface(pluginId);
  if (surface == null) {
    return null;
  }
  return surface.resolveTourKindDuration(category);
}

export function matchesTourCategoryFilter(
  category: string | null,
  filter: TourCategoryFilter
): boolean {
  if (filter === TOUR_CATEGORY_FILTER_ALL) {
    return true;
  }
  return category === filter;
}

/** @deprecated Use isTourKindSlug(pluginId, value) */
export function isDenaliTourCategory(pluginId: string, value: string | null): boolean {
  return isTourKindSlug(pluginId, value);
}

/** @deprecated Use resolveTourKindDuration(pluginId, category) */
export function resolveDenaliTourKindDuration(
  pluginId: string,
  category: string | null
): "single_day" | "multi_day" | null {
  return resolveTourKindDuration(pluginId, category);
}
