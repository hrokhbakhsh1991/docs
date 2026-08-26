export const DENALI_CATALOG_CHIP_PREVIEW_LIMIT = 3;

/** Picker panel stays open when empty; collapses to chip summary once items are chosen. */
export function resolveDenaliCatalogPickerDefaultExpanded(selectedCount: number): boolean {
  return selectedCount === 0;
}

export function partitionCatalogChipPreview<T>(
  items: readonly T[],
  limit: number = DENALI_CATALOG_CHIP_PREVIEW_LIMIT
): { readonly visible: readonly T[]; readonly overflowCount: number } {
  if (items.length <= limit) {
    return { visible: items, overflowCount: 0 };
  }
  return {
    visible: items.slice(0, limit),
    overflowCount: items.length - limit,
  };
}

export function truncateCatalogChipLabel(label: string, maxLength: number = 22): string {
  const trimmed = label.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return `${trimmed.slice(0, Math.max(1, maxLength - 1))}…`;
}
