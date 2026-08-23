/**
 * Thin Shell Phase 4ax — tour-list category via capabilities.tourListCategory.
 * Product-blind warm cache supports sync resolve after ensure; binder deleted.
 */

import {
  resolveTourListCategoryCapability,
  type WorkspacePlugin,
  type WorkspaceTourListCategoryCapability,
} from "@app-tour/workspace-sdk";

import { loadBootstrapWorkspacePlugin } from "@/bootstrap/resolve-bootstrap-workspace-plugin";
import { writeCachedTourPlugin } from "@/features/tours/tour-route-cache";
import type { TourListCategorySurface } from "@/features/tours/tour-list-category-surface-types";

export const TOUR_LIST_CATEGORY_CACHE_KEY = "app-cloud.tourListCategoryCache";

type GlobalRegistry = typeof globalThis & {
  [TOUR_LIST_CATEGORY_CACHE_KEY]?: Map<string, TourListCategorySurface>;
};

function getCache(): Map<string, TourListCategorySurface> {
  const g = globalThis as GlobalRegistry;
  let cache = g[TOUR_LIST_CATEGORY_CACHE_KEY];
  if (cache == null) {
    cache = new Map();
    g[TOUR_LIST_CATEGORY_CACHE_KEY] = cache;
  }
  return cache;
}

function surfaceFromPlugin(plugin: WorkspacePlugin): TourListCategorySurface | null {
  const cap: WorkspaceTourListCategoryCapability | undefined =
    resolveTourListCategoryCapability(plugin);
  if (cap == null) {
    return null;
  }
  return cap as TourListCategorySurface;
}

/** Warm product surface via capability (no generated binder). */
export async function ensureTourListCategorySurface(
  pluginId: string
): Promise<TourListCategorySurface | null> {
  if (pluginId.trim().length === 0) {
    return null;
  }
  const cached = getCache().get(pluginId);
  if (cached != null) {
    return cached;
  }
  try {
    const plugin = await loadBootstrapWorkspacePlugin(pluginId);
    writeCachedTourPlugin(pluginId, plugin);
    const surface = surfaceFromPlugin(plugin);
    if (surface == null) {
      return null;
    }
    getCache().set(pluginId, surface);
    return surface;
  } catch {
    return null;
  }
}

/** Sync read of warm cache — call ensureTourListCategorySurface first. */
export function resolveTourListCategorySurface(
  pluginId: string
): TourListCategorySurface | null {
  return getCache().get(pluginId) ?? null;
}
