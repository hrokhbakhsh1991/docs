import type { EquipmentResource, TourThemeResource } from "../adapters/catalog-types";

type ThemeNameLookup = ReadonlyMap<string, Pick<TourThemeResource, "name">>;

export function resolveEquipmentThemeNames(
  themeIds: readonly string[] | undefined,
  themesById: ThemeNameLookup
): readonly string[] {
  return (themeIds ?? [])
    .map((id) => themesById.get(id)?.name?.trim())
    .filter((name): name is string => name !== undefined && name.length > 0);
}

export function resolveEquipmentCatalogSearchText(
  item: EquipmentResource,
  themeNames: readonly string[]
): string {
  return [item.name, item.category, ...themeNames].filter(Boolean).join(" ");
}

export function resolveTourCategoryLabelKey(category: string): string {
  return `composites.tourKind.categories.${category}`;
}

type ResolveEquipmentCatalogSubtitleOptions = {
  readonly formatThemeNames: (names: readonly string[]) => string;
  readonly resolveCategoryLabel: (category: string) => string | null;
  readonly allThemesLabel: string;
};

/** Secondary line under equipment name — mirrors Settings → Equipment list copy. */
export function resolveEquipmentCatalogSubtitle(
  item: EquipmentResource,
  themesById: ThemeNameLookup,
  options: ResolveEquipmentCatalogSubtitleOptions
): string {
  const themeNames = resolveEquipmentThemeNames(item.themeIds, themesById);
  if (themeNames.length > 0) {
    return options.formatThemeNames(themeNames);
  }

  const category = item.category?.trim() ?? "";
  if (category.length > 0) {
    const categoryLabel = options.resolveCategoryLabel(category);
    if (categoryLabel != null && categoryLabel.length > 0) {
      return categoryLabel;
    }
  }

  return options.allThemesLabel;
}
