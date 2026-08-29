import { TOUR_CATEGORY_FILTER_ALL } from "./tour-list-category-logic";
import { DEFAULT_TOUR_LIST_QUERY, type TourListQueryModel, type TourListStatusFilter } from "./query-model";

/** UI-facing status labels (legacy parity). */
export type TourStatusUiFilter = "all" | "draft" | "active" | "archived";

export const TOUR_STATUS_UI_OPTIONS: readonly TourStatusUiFilter[] = [
  "all",
  "draft",
  "active",
] as const;

export function uiStatusToQueryStatus(ui: TourStatusUiFilter): TourListStatusFilter {
  switch (ui) {
    case "all":
      return "all";
    case "draft":
      return "active";
    case "active":
      return "completed";
    case "archived":
      return "archived";
    default:
      return "all";
  }
}

export function queryStatusToUiStatus(status: TourListStatusFilter): TourStatusUiFilter {
  switch (status) {
    case "all":
      return "all";
    case "active":
      return "draft";
    case "completed":
      return "active";
    case "archived":
      return "archived";
    default:
      return "all";
  }
}

export function tourListQueryHasFilters(query: TourListQueryModel): boolean {
  return (
    query.search.trim().length > 0 ||
    query.status !== "all" ||
    query.category !== TOUR_CATEGORY_FILTER_ALL
  );
}

export const TOURS_LIST_SORT_OPTIONS = [
  "departure_at",
  "created_at",
  "title",
  "price",
] as const satisfies readonly TourListQueryModel["sortBy"][];

export function toursListAdvancedFiltersDirty(query: TourListQueryModel): boolean {
  return (
    query.status !== "all" ||
    query.category !== TOUR_CATEGORY_FILTER_ALL ||
    query.sortBy !== DEFAULT_TOUR_LIST_QUERY.sortBy ||
    query.sortDir !== DEFAULT_TOUR_LIST_QUERY.sortDir
  );
}

export function clearToursListAdvancedFilters(
  query: TourListQueryModel
): TourListQueryModel {
  return {
    ...query,
    status: "all",
    category: TOUR_CATEGORY_FILTER_ALL,
    sortBy: DEFAULT_TOUR_LIST_QUERY.sortBy,
    sortDir: DEFAULT_TOUR_LIST_QUERY.sortDir,
    page: 1,
  };
}

export function withToursListPaginationReset(
  query: TourListQueryModel
): TourListQueryModel {
  return { ...query, page: 1 };
}

export function tourListTotalPages(total: number, limit: number): number {
  return Math.max(1, Math.ceil(total / limit));
}
