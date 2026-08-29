export type TourListStatusFilter = "all" | "active" | "completed" | "archived";

import {
  TOUR_CATEGORY_FILTER_ALL,
  type TourCategoryFilter,
  isTourKindSlug,
} from "./tour-list-category-logic";

export type TourListQueryModel = {
  readonly search: string;
  readonly page: number;
  readonly limit: number;
  readonly status: TourListStatusFilter;
  readonly category: TourCategoryFilter;
  readonly sortBy: "created_at" | "title" | "price" | "departure_at";
  readonly sortDir: "asc" | "desc";
};

export const TOURS_LIST_TEST_IDS = {
  page: "operator-tours-page",
  controls: "operator-tours-controls",
  list: "operator-tours-list",
  search: "operator-tours-search",
  status: "operator-tours-status",
  filtersToggle: "operator-tours-filters-toggle",
  filtersPanel: "operator-tours-filters-panel",
  activeFilters: "operator-tours-active-filters",
  sort: "operator-tours-sort",
  sortSelect: "operator-tours-sort-select",
  pagination: "operator-tours-pagination",
  empty: "operator-tours-empty",
  emptyCatalog: "operator-tours-empty-catalog",
  duplicate: "operator-tours-duplicate",
  duplicateServer: "operator-tours-duplicate-server",
  secondaryActions: "operator-tours-secondary-actions",
  workspace: "operator-tours-workspace",
  retry: "operator-tours-retry",
  createdNotice: "operator-tours-created-notice",
  category: "operator-tours-category",
  cardMeta: "operator-tours-card-meta",
  cardDuration: "operator-tours-card-duration",
  cardCover: "operator-tours-card-cover",
  toolbarSkeleton: "operator-tours-toolbar-skeleton",
  listSkeleton: "operator-tours-list-skeleton",
  cardSkeleton: "operator-tours-card-skeleton",
} as const;

export const DEFAULT_TOUR_LIST_QUERY: TourListQueryModel = {
  search: "",
  page: 1,
  limit: 10,
  status: "all",
  category: TOUR_CATEGORY_FILTER_ALL,
  sortBy: "departure_at",
  sortDir: "asc",
};

export function serializeTourListQuery(query: TourListQueryModel): string {
  const params = new URLSearchParams();
  params.set("view", "operator");
  if (query.search.trim().length > 0) {
    params.set("search", query.search.trim());
  }
  if (query.status !== "all") {
    params.set("status", query.status);
  }
  if (query.category !== TOUR_CATEGORY_FILTER_ALL) {
    params.set("category", query.category);
  }
  if (query.page !== 1) {
    params.set("page", String(query.page));
  }
  if (query.limit !== 10) {
    params.set("limit", String(query.limit));
  }
  if (query.sortBy !== DEFAULT_TOUR_LIST_QUERY.sortBy) {
    params.set("sort_by", query.sortBy);
  }
  if (query.sortDir !== DEFAULT_TOUR_LIST_QUERY.sortDir) {
    params.set("sort_dir", query.sortDir);
  }
  return params.toString();
}

export function parseTourListQuery(
  pluginId: string,
  searchParams: URLSearchParams
): TourListQueryModel {
  const statusRaw = searchParams.get("status");
  const status =
    statusRaw === "active" || statusRaw === "completed" || statusRaw === "archived"
      ? statusRaw
      : "all";
  const sortByRaw = searchParams.get("sort_by");
  const sortBy =
    sortByRaw === "created_at" ||
    sortByRaw === "title" ||
    sortByRaw === "price" ||
    sortByRaw === "departure_at"
      ? sortByRaw
      : DEFAULT_TOUR_LIST_QUERY.sortBy;
  const sortDir = searchParams.get("sort_dir") === "desc" ? "desc" : DEFAULT_TOUR_LIST_QUERY.sortDir;
  const pageRaw = Number(searchParams.get("page") ?? "1");
  const limitRaw = Number(searchParams.get("limit") ?? "10");
  const categoryRaw = searchParams.get("category");
  const category =
    categoryRaw !== null && isTourKindSlug(pluginId, categoryRaw)
      ? categoryRaw
      : TOUR_CATEGORY_FILTER_ALL;

  return {
    search: searchParams.get("search")?.trim() ?? "",
    page: Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1,
    limit: Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(Math.floor(limitRaw), 100) : 10,
    status,
    category,
    sortBy,
    sortDir,
  };
}
