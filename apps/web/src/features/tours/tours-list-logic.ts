import { TOUR_CATEGORY_FILTER_ALL } from "./tour-list-category-logic";
import type { TourListQueryModel, TourListStatusFilter } from "./query-model";

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

export function tourListTotalPages(total: number, limit: number): number {
  return Math.max(1, Math.ceil(total / limit));
}
