export function normalizeSortOrder<T extends { id: string }>(items: T[]) {
  return items.map((item, index) => ({
    id: item.id,
    sortOrder: index,
  }));
}

/**
 * Returns `{ id, sortOrder }` only for ids whose numeric order changed vs `previous`.
 */
export function pickSortOrderDeltas<T extends { id: string; sortOrder?: number | null }>(
  previous: T[],
  proposed: { id: string; sortOrder: number }[],
): { id: string; sortOrder: number }[] {
  const prevMap = new Map(previous.map((p) => [p.id, p.sortOrder ?? 0]));
  return proposed.filter((p) => (prevMap.get(p.id) ?? 0) !== p.sortOrder);
}
