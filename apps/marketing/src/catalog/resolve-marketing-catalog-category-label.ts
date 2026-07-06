import {
  isDenaliMarketingCategoryGroup,
  type DenaliMarketingCategoryGroup,
} from "@app-tour/workspace-denali/marketing";

/** Chip / pill label for catalog category filter (group or legacy slug). */
export function resolveMarketingCatalogCategoryFilterLabel(
  category: string,
  translate: (key: string) => string
): string {
  const normalized = category.trim();
  if (normalized.length === 0) {
    return normalized;
  }

  if (isDenaliMarketingCategoryGroup(normalized)) {
    const groupKey = `list.filters.categoryGroups.${normalized as DenaliMarketingCategoryGroup}`;
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

function resolveDenaliCategoryGroupKey(slug: string): DenaliMarketingCategoryGroup | null {
  if (slug.startsWith("mountain_")) {
    return "mountain";
  }
  if (slug.startsWith("nature_")) {
    return "nature";
  }
  return null;
}

/** Localized category line on list/detail cards (wizard slug → fa/en label). */
export function resolveMarketingCatalogCardCategoryLabel(
  categorySlug: string | null | undefined,
  translate: (key: string) => string
): string | null {
  const normalized = categorySlug?.trim() ?? "";
  if (normalized.length === 0) {
    return null;
  }

  const slugKey = `home.full.categories.labels.${normalized}`;
  const slugLabel = translate(slugKey);
  if (slugLabel !== slugKey && slugLabel.trim().length > 0) {
    return slugLabel;
  }

  const group = resolveDenaliCategoryGroupKey(normalized);
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
