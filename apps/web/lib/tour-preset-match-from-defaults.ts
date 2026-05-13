/** Derive API match columns from stored wizard defaults (overview). */
export function matchRulesFromPresetDefaults(defaults: Record<string, unknown>): {
  matchTourType: string | null;
  matchMainTourThemeId: string | null;
} {
  const ovRaw = defaults?.overview;
  if (ovRaw == null || typeof ovRaw !== "object" || Array.isArray(ovRaw)) {
    return { matchTourType: null, matchMainTourThemeId: null };
  }
  const ov = ovRaw as Record<string, unknown>;
  const tourType = typeof ov.tourType === "string" && ov.tourType.trim() !== "" ? ov.tourType.trim() : null;
  const mainTourThemeId =
    typeof ov.mainTourThemeId === "string" && ov.mainTourThemeId.trim() !== "" ? ov.mainTourThemeId.trim() : null;
  return { matchTourType: tourType, matchMainTourThemeId: mainTourThemeId };
}
