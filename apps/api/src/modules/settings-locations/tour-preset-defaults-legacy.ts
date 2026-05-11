/**
 * Legacy presets stored matchTourType / matchMainTourThemeId columns.
 * We fold those into `defaults.overview` for API consumers and clear columns on write.
 */
export function mergeLegacyMatchIntoDefaults(
  defaults: Record<string, unknown>,
  matchTourType: string | null | undefined,
  matchMainTourThemeId: string | null | undefined,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...defaults };
  const ovRaw = out.overview;
  const overview =
    ovRaw != null && typeof ovRaw === "object" && !Array.isArray(ovRaw)
      ? ({ ...(ovRaw as Record<string, unknown>) } as Record<string, unknown>)
      : {};

  const typeTrim =
    matchTourType != null && String(matchTourType).trim() !== "" ? String(matchTourType).trim() : null;
  const themeTrim =
    matchMainTourThemeId != null && String(matchMainTourThemeId).trim() !== ""
      ? String(matchMainTourThemeId).trim()
      : null;

  const existingType =
    typeof overview.tourType === "string" && overview.tourType.trim() !== "" ? overview.tourType.trim() : null;
  const existingTheme =
    typeof overview.mainTourThemeId === "string" && overview.mainTourThemeId.trim() !== ""
      ? overview.mainTourThemeId.trim()
      : null;

  if (typeTrim && !existingType) {
    overview.tourType = typeTrim;
  }
  if (themeTrim && !existingTheme) {
    overview.mainTourThemeId = themeTrim;
  }

  if (Object.keys(overview).length > 0) {
    out.overview = overview;
  }
  return out;
}
