import type {
  OperatorListSortBy,
  OperatorListSortDir,
  OperatorListStatusFilter,
  OperatorListToursQuery,
  OperatorTourListResult,
} from "./list-tours-operator";

export type ListToursView = "slim" | "operator";

export type ListToursQuery = {
  readonly view: ListToursView;
  readonly limit: number;
  readonly cursor?: string;
  readonly operator?: OperatorListToursQuery;
};

export type TourListItem = {
  readonly id: string;
  readonly tenantId: string;
  readonly createdAt: string;
  readonly rowVersion: number;
};

export type TourListResult = {
  readonly items: readonly TourListItem[];
  readonly nextCursor: string | null;
};

export type { OperatorListToursQuery, OperatorTourListResult };

const DEFAULT_SLIM_LIMIT = 50;
const DEFAULT_OPERATOR_LIMIT = 10;
const DEFAULT_MAX_LIMIT = 100;

export function resolveTourListMaxLimit(): number {
  const raw = process.env.HTTP_TOUR_LIST_MAX_LIMIT?.trim();
  if (raw === undefined || raw.length === 0) {
    return DEFAULT_MAX_LIMIT;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_MAX_LIMIT;
  }
  return Math.floor(parsed);
}

function parsePositiveInt(raw: string | null, fallback: number, max: number): number {
  if (raw === null || raw.length === 0) {
    return Math.min(fallback, max);
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return Math.min(fallback, max);
  }
  return Math.min(Math.floor(parsed), max);
}

function parseListView(searchParams: URLSearchParams): ListToursView {
  const view = searchParams.get("view")?.trim().toLowerCase();
  return view === "slim" ? "slim" : "operator";
}

function parseOperatorSortBy(raw: string | null): OperatorListSortBy {
  if (raw === "title" || raw === "price" || raw === "departure_at") {
    return raw;
  }
  return "created_at";
}

function parseOperatorSortDir(raw: string | null): OperatorListSortDir {
  return raw === "asc" ? "asc" : "desc";
}

function parseOperatorStatus(raw: string | null): OperatorListStatusFilter | undefined {
  if (raw === "active" || raw === "completed" || raw === "archived") {
    return raw;
  }
  return undefined;
}

const OPERATOR_TOUR_CATEGORY_SLUGS = new Set([
  "mountain_day",
  "mountain_multi",
  "nature_day",
  "nature_multi",
  "desert_day",
  "desert_multi",
  "event_reading",
  "event_reading_multi",
  "event_cinema",
  "event_cinema_multi",
]);

function parseOperatorCategory(raw: string | null): string | undefined {
  const trimmed = raw?.trim();
  if (trimmed === undefined || trimmed.length === 0) {
    return undefined;
  }
  if (!OPERATOR_TOUR_CATEGORY_SLUGS.has(trimmed)) {
    return undefined;
  }
  return trimmed;
}

function parseOperatorListQuery(searchParams: URLSearchParams): OperatorListToursQuery {
  const maxLimit = resolveTourListMaxLimit();
  const searchRaw = searchParams.get("search")?.trim();
  const search =
    searchRaw && searchRaw.length > 0 ? searchRaw.slice(0, 200) : undefined;
  const includeTotalRaw = searchParams.get("include_total")?.trim().toLowerCase();
  const includeTotal = includeTotalRaw !== "false";

  return {
    search,
    status: parseOperatorStatus(searchParams.get("status")),
    category: parseOperatorCategory(searchParams.get("category")),
    page: Math.max(1, parsePositiveInt(searchParams.get("page"), 1, Number.MAX_SAFE_INTEGER)),
    limit: parsePositiveInt(searchParams.get("limit"), DEFAULT_OPERATOR_LIMIT, maxLimit),
    sortBy: parseOperatorSortBy(searchParams.get("sort_by")),
    sortDir: parseOperatorSortDir(searchParams.get("sort_dir")),
    includeTotal,
  };
}

export function parseListToursQuery(searchParams: URLSearchParams): ListToursQuery {
  const maxLimit = resolveTourListMaxLimit();
  const view = parseListView(searchParams);
  const defaultLimit = view === "slim" ? DEFAULT_SLIM_LIMIT : DEFAULT_OPERATOR_LIMIT;
  const limit = parsePositiveInt(searchParams.get("limit"), defaultLimit, maxLimit);

  const cursorRaw = searchParams.get("cursor")?.trim();
  const cursor = cursorRaw && cursorRaw.length > 0 ? cursorRaw : undefined;

  if (view === "operator") {
    return { view, limit, operator: parseOperatorListQuery(searchParams) };
  }

  return { view, limit, cursor };
}
