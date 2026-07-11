import type { TourListPageInput, TourRecord, TourWhere } from "./tour-record";

/** Bounded page size when materializing full tenant tour lists for operator filters. */
export const TOUR_LIST_PAGE_CHUNK_SIZE = 100;

export type TourListPageReader = {
  listPage(
    extra: Partial<TourWhere> | undefined,
    page: TourListPageInput
  ): Promise<{ readonly items: readonly TourRecord[]; readonly nextCursor: string | null }>;
};

/**
 * Loads all tour records for a tenant scope via repeated bounded `listPage` calls.
 * Replaces unbounded `findMany` / `listByTenant(MAX_SAFE_INTEGER)` for operator list paths.
 */
export async function loadAllTourRecordsViaListPage(
  repo: TourListPageReader,
  extra?: Partial<TourWhere>
): Promise<readonly TourRecord[]> {
  const items: TourRecord[] = [];
  let cursor: string | undefined;
  for (;;) {
    const page = await repo.listPage(extra, {
      limit: TOUR_LIST_PAGE_CHUNK_SIZE,
      ...(cursor !== undefined ? { cursor } : {}),
    });
    items.push(...page.items);
    if (page.nextCursor === null) {
      return items;
    }
    cursor = page.nextCursor;
  }
}
