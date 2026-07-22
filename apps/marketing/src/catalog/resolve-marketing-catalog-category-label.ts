import {
  resolveMarketingCatalogSurface,
} from "./resolve-marketing-catalog-surface";
import type {
  MarketingCatalogSurface,
  MarketingCategoryGroup,
} from "./marketing-catalog-surface-types";

/** Chip / pill label for catalog category filter (group or legacy slug). */
export async function resolveMarketingCatalogCategoryFilterLabel(
  category: string,
  translate: (key: string) => string,
  pluginId?: string
): Promise<string> {
  const normalized = category.trim();
  if (normalized.length === 0) {
    return normalized;
  }

  const surface = pluginId != null ? await resolveMarketingCatalogSurface(pluginId) : null;
  if (surface != null && surface.isCategoryGroup(normalized)) {
    const groupKey = `list.filters.categoryGroups.${normalized as MarketingCategoryGroup}`;
    const groupLabel = translate(groupKey);
    if (groupLabel !== groupKey && groupLabel.trim().length > 0) {
      return groupLabel;
    }
  }

  const slugKey = `home.full.categories.labels.${normalized}`;
  const slugLabel = translate(slugKey);
  if (slugLabel !== slugKey && slugLabel.trim().length > 0) {
    return slugLabel;
  }

  return normalized.replace(/_/g, " ");
}

function resolveCategoryGroupKey(
  slug: string,
  surface: MarketingCatalogSurface | null
): MarketingCategoryGroup | null {
  if (surface != null) {
    return surface.resolveCategoryFamily(slug);
  }
  if (slug.startsWith("mountain_")) {
    return "mountain";
  }
  if (slug.startsWith("nature_")) {
    return "nature";
  }
  return null;
}

/** Localized category line on list/detail cards (wizard slug → fa/en label). */
export async function resolveMarketingCatalogCardCategoryLabel(
  categorySlug: string | null | undefined,
  translate: (key: string) => string,
  pluginId?: string
): Promise<string | null> {
  const normalized = categorySlug?.trim() ?? "";
  if (normalized.length === 0) {
    return null;
  }

  const slugKey = `home.full.categories.labels.${normalized}`;
  const slugLabel = translate(slugKey);
  if (slugLabel !== slugKey && slugLabel.trim().length > 0) {
    return slugLabel;
  }

  const surface = pluginId != null ? await resolveMarketingCatalogSurface(pluginId) : null;
  const group = resolveCategoryGroupKey(normalized, surface);
  if (group != null) {
    const groupKey = `list.filters.categoryGroups.${group}`;
    const groupLabel = translate(groupKey);
    if (groupLabel !== groupKey && groupLabel.trim().length > 0) {
      return groupLabel;
    }
  }

  const fallback = normalized.replace(/_/g, " ");
  return fallback.length > 0 ? fallback : null;
}
