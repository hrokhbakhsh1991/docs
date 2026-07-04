/** Localized fitness level slug (low / medium / high). */
export function resolveMarketingCatalogFitnessLevelLabel(
  fitnessLevel: string | null | undefined,
  translate: (key: string) => string
): string | null {
  const level = fitnessLevel?.trim();
  if (level == null || level.length === 0) {
    return null;
  }

  const levelKey = `list.filters.fitnessLevels.${level}`;
  const localized = translate(levelKey);
  if (localized !== levelKey && localized.trim().length > 0) {
    return localized;
  }

  return level;
}

/** Card/detail stat line — label + localized level (not raw English slug). */
export function resolveMarketingCatalogFitnessLabel(
  fitnessLevel: string | null | undefined,
  translate: (key: string, values?: Record<string, string | number>) => string
): string | null {
  const levelLabel = resolveMarketingCatalogFitnessLevelLabel(fitnessLevel, translate);
  if (levelLabel == null) {
    return null;
  }
  return translate("detail.fitness", { level: levelLabel });
}
