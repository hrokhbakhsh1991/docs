const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const DEFAULT_STATUS = "all" as const;
const DEFAULT_SORT = { column: "createdAt", dir: "desc" as const };

const STATUSES = ["all", "active", "completed", "archived"] as const;

export type TourListQueryModel = {
  search: string;
  page: number;
  limit: number;
  status: (typeof STATUSES)[number];
  sort: {
    column: string;
    dir: "asc" | "desc";
  };
};

function parsePositiveInt(raw: string | null, fallback: number): number {
  if (raw == null || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) return fallback;
  return n;
}

function parseSortFromUrl(raw: string | null): TourListQueryModel["sort"] {
  if (!raw) {
    return { column: DEFAULT_SORT.column, dir: DEFAULT_SORT.dir };
  }
  const dot = raw.indexOf(".");
  if (dot <= 0 || dot === raw.length - 1) {
    return { column: DEFAULT_SORT.column, dir: DEFAULT_SORT.dir };
  }
  const column = raw.slice(0, dot);
  const dir = raw.slice(dot + 1);
  if (!column || (dir !== "asc" && dir !== "desc")) {
    return { column: DEFAULT_SORT.column, dir: DEFAULT_SORT.dir };
  }
  return { column, dir };
}

function normalizeStatus(raw: string | null): TourListQueryModel["status"] {
  const v = raw ?? DEFAULT_STATUS;
  return STATUSES.includes(v as TourListQueryModel["status"]) ? (v as TourListQueryModel["status"]) : DEFAULT_STATUS;
}

function sortToParam(sort: TourListQueryModel["sort"]): string {
  return `${sort.column}.${sort.dir}`;
}

function isDefaultSort(sort: TourListQueryModel["sort"]): boolean {
  return sort.column === DEFAULT_SORT.column && sort.dir === DEFAULT_SORT.dir;
}

export function parseUrlToQueryModel(params: URLSearchParams): TourListQueryModel {
  return {
    search: params.get("search") ?? "",
    page: parsePositiveInt(params.get("page"), DEFAULT_PAGE),
    limit: parsePositiveInt(params.get("limit"), DEFAULT_LIMIT),
    status: normalizeStatus(params.get("status")),
    sort: parseSortFromUrl(params.get("sort")),
  };
}

/**
 * Omits defaults. Stable insertion order: limit → page → search → sort → status (alphabetical).
 */
export function serializeQueryModel(model: TourListQueryModel): string {
  const params = new URLSearchParams();

  if (model.limit !== DEFAULT_LIMIT) {
    params.set("limit", String(model.limit));
  }
  if (model.page !== DEFAULT_PAGE) {
    params.set("page", String(model.page));
  }
  if (model.search !== "") {
    params.set("search", model.search);
  }
  if (!isDefaultSort(model.sort)) {
    params.set("sort", sortToParam(model.sort));
  }
  if (model.status !== DEFAULT_STATUS) {
    params.set("status", model.status);
  }

  return params.toString();
}
