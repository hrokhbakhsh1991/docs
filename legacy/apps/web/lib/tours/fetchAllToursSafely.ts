import { getTours, type GetToursParams, type TourDetailDto } from "@/lib/services/tours.service";

export const DEFAULT_MAX_TOUR_PAGES = 10;

export type FetchAllToursSafelyResult = {
  tours: TourDetailDto[];
  total: number;
  limit: number;
  pagesFetched: number;
  partial: boolean;
};

/**
 * Fetches paginated tours up to a capped number of pages.
 * Returns `partial=true` when the cap is reached before exhausting pages.
 */
export async function fetchAllToursSafely(
  params?: Omit<GetToursParams, "page"> & { maxPages?: number },
): Promise<FetchAllToursSafelyResult> {
  const maxPages = Math.max(1, params?.maxPages ?? DEFAULT_MAX_TOUR_PAGES);
  const baseParams: Omit<GetToursParams, "page"> = {
    search: params?.search,
    limit: params?.limit,
    status: params?.status,
  };

  const byId = new Map<string, TourDetailDto>();
  let total = 0;
  let limit = params?.limit ?? 0;
  let pagesFetched = 0;
  let page = 1;

  while (page <= maxPages) {
    const res = await getTours({ ...baseParams, page });
    pagesFetched += 1;
    total = res.total;
    limit = res.limit;
    for (const tour of res.tours) {
      if (tour.id) byId.set(tour.id, tour);
    }

    const expectedPages = Math.max(1, Math.ceil((res.total || 0) / Math.max(1, res.limit || 1)));
    if (page >= expectedPages) {
      return {
        tours: Array.from(byId.values()),
        total,
        limit: res.limit,
        pagesFetched,
        partial: false,
      };
    }
    page += 1;
  }

  return {
    tours: Array.from(byId.values()),
    total,
    limit,
    pagesFetched,
    partial: true,
  };
}
