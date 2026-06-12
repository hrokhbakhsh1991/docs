/** Equipment `themeIds` → visible when tour `program.themeIds` intersects (empty = all themes). */
export function isEquipmentCompatibleWithTourThemes(
  equipmentThemeIds: readonly string[] | null | undefined,
  tourThemeIds: readonly string[] | null | undefined
): boolean {
  const allowed = (equipmentThemeIds ?? []).filter((id) => id.trim().length > 0);
  if (allowed.length === 0) {
    return true;
  }
  const selected = (tourThemeIds ?? []).filter((id) => id.trim().length > 0);
  if (selected.length === 0) {
    return true;
  }
  const selectedSet = new Set(selected);
  return allowed.some((id) => selectedSet.has(id));
}
