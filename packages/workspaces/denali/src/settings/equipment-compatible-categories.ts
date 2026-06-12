/** Denali equipment row `category` → wizard tour categories this gear item applies to. */
export function resolveEquipmentCompatibleCategories(
  category: string | null | undefined
): readonly string[] {
  if (category == null) {
    return [];
  }
  const trimmed = category.trim();
  if (trimmed.length === 0) {
    return [];
  }
  return [trimmed];
}
