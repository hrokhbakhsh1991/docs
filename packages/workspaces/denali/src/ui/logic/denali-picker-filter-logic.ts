export function filterPickerItemsByQuery<T>(
  items: readonly T[],
  query: string,
  readSearchText: (item: T) => string
): readonly T[] {
  const normalized = query.trim().toLowerCase();
  if (normalized.length === 0) {
    return items;
  }
  return items.filter((item) => readSearchText(item).toLowerCase().includes(normalized));
}
