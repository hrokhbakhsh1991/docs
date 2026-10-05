export type CatalogListSort =
  | "newest"
  | "departure_asc"
  | "departure_desc"
  | "price_asc"
  | "price_desc"
  | "difficulty_asc";

export type CatalogListQueryInput = {
  readonly cursor?: string;
  readonly city?: string;
  readonly q?: string;
  readonly category?: string;
  readonly difficulty?: string;
  readonly fitness?: string;
  readonly availability?: string;
  readonly minPrice?: string;
  readonly maxPrice?: string;
  readonly minDuration?: string;
  readonly maxDuration?: string;
  readonly sort?: string;
};

/** Next.js `searchParams` values may be repeated query keys. */
export type CatalogListQueryInputRaw = {
  readonly [K in keyof CatalogListQueryInput]?: string | string[] | undefined;
};

function readCatalogListQueryValue(value: string | string[] | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (Array.isArray(value)) {
    const first = value.find((part) => part.trim().length > 0);
    return first?.trim();
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export type CatalogListFilters = {
  readonly q?: string;
  readonly category?: string;
  readonly difficulty?: number;
  readonly fitness?: string;
  readonly availability?: "open";
  readonly minPrice?: number;
  readonly maxPrice?: number;
  readonly minDuration?: number;
  readonly maxDuration?: number;
  readonly sort: CatalogListSort;
  readonly cursor?: string;
  readonly city?: string;
};

/** Public catalog API max page size (`public-catalog.md`). */
export const CATALOG_API_MAX_LIMIT = 50;

export const CATALOG_DEFAULT_PAGE_LIMIT = 20;

const CATALOG_LIST_SORTS: readonly CatalogListSort[] = [
  "newest",
  "departure_asc",
  "departure_desc",
  "price_asc",
  "price_desc",
  "difficulty_asc",
];

export function parseCatalogListSort(value: string | undefined): CatalogListSort {
  const normalized = value?.trim();
  if (normalized != null && (CATALOG_LIST_SORTS as readonly string[]).includes(normalized)) {
    return normalized as CatalogListSort;
  }
  return "newest";
}

export function parseCatalogListFilters(
  input: CatalogListQueryInput | CatalogListQueryInputRaw
): CatalogListFilters {
  const difficultyRaw = readCatalogListQueryValue(input.difficulty);
  const difficulty =
    difficultyRaw != null && Number.isFinite(Number(difficultyRaw))
      ? Number(difficultyRaw)
      : undefined;
  const fitness = readCatalogListQueryValue(input.fitness);
  const availability =
    readCatalogListQueryValue(input.availability) === "open" ? "open" : undefined;
  const q = readCatalogListQueryValue(input.q);
  const categoryRaw = readCatalogListQueryValue(input.category);
  const category =
    categoryRaw != null && categoryRaw.toLowerCase() === "all" ? undefined : categoryRaw;
  const cursor = readCatalogListQueryValue(input.cursor);
  const city = readCatalogListQueryValue(input.city);
  const parseNonNegative = (value: string | undefined): number | undefined => {
    if (value == null || !/^\d+(?:\.\d+)?$/.test(value)) {
      return undefined;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
  };
  const minPrice = parseNonNegative(readCatalogListQueryValue(input.minPrice));
  const maxPrice = parseNonNegative(readCatalogListQueryValue(input.maxPrice));
  const minDuration = parseNonNegative(readCatalogListQueryValue(input.minDuration));
  const maxDuration = parseNonNegative(readCatalogListQueryValue(input.maxDuration));

  return {
    ...(q != null ? { q } : {}),
    ...(category != null ? { category } : {}),
    ...(difficulty != null ? { difficulty } : {}),
    ...(fitness != null ? { fitness } : {}),
    ...(availability != null ? { availability } : {}),
    sort: parseCatalogListSort(readCatalogListQueryValue(input.sort)),
    ...(cursor != null ? { cursor } : {}),
    ...(city != null ? { city } : {}),
    ...(minPrice != null ? { minPrice } : {}),
    ...(maxPrice != null ? { maxPrice } : {}),
    ...(minDuration != null ? { minDuration } : {}),
    ...(maxDuration != null ? { maxDuration } : {}),
  };
}

/** Native GET forms submit empty controls; redirect those URLs to the canonical query. */
export function catalogListQueryHasEmptyValues(input: CatalogListQueryInputRaw): boolean {
  return Object.values(input).some((value) => {
    const values = Array.isArray(value) ? value : [value];
    return values.some((part) => part != null && part.trim().length === 0);
  });
}

/** Narrowing filters that require a wider catalog fetch when applied. */
export function catalogListHasNarrowingFilters(filters: CatalogListFilters): boolean {
  return (
    (filters.q != null && filters.q.length > 0) ||
    (filters.category != null && filters.category.length > 0) ||
    filters.difficulty != null ||
    (filters.fitness != null && filters.fitness.length > 0) ||
    filters.availability === "open" ||
    filters.minPrice != null ||
    filters.maxPrice != null ||
    filters.minDuration != null ||
    filters.maxDuration != null
  );
}

export function buildCatalogListQuery(input: CatalogListQueryInput): string {
  const query = new URLSearchParams();
  const set = (key: string, value: string | undefined) => {
    const trimmed = value?.trim();
    if (trimmed != null && trimmed.length > 0) {
      query.set(key, trimmed);
    }
  };

  set("city", input.city);
  set("q", input.q);
  set("category", input.category);
  set("difficulty", input.difficulty);
  set("fitness", input.fitness);
  if (input.availability?.trim() === "open") {
    query.set("availability", "open");
  }
  set("minPrice", input.minPrice);
  set("maxPrice", input.maxPrice);
  set("minDuration", input.minDuration);
  set("maxDuration", input.maxDuration);
  const sort = parseCatalogListSort(input.sort);
  if (sort !== "newest") {
    query.set("sort", sort);
  }
  set("cursor", input.cursor);

  const serialized = query.toString();
  return serialized.length > 0 ? `?${serialized}` : "";
}

/** Filters that narrow the in-memory result set (not sort/city alone). */
export function catalogListHasClientFilters(
  filters: CatalogListFilters,
  serverListFilters: readonly string[] = []
): boolean {
  return (
    (filters.q != null && filters.q.length > 0 && !serverListFilters.includes("q")) ||
    (filters.category != null &&
      filters.category.length > 0 &&
      !serverListFilters.includes("category")) ||
    (filters.difficulty != null && !serverListFilters.includes("difficulty")) ||
    (filters.fitness != null &&
      filters.fitness.length > 0 &&
      !serverListFilters.includes("fitness")) ||
    (filters.availability === "open" && !serverListFilters.includes("availability")) ||
    (filters.minPrice != null && !serverListFilters.includes("minPrice")) ||
    (filters.maxPrice != null && !serverListFilters.includes("maxPrice")) ||
    (filters.minDuration != null && !serverListFilters.includes("minDuration")) ||
    (filters.maxDuration != null && !serverListFilters.includes("maxDuration"))
  );
}

export function catalogListHasActiveFilters(
  filters: CatalogListFilters,
  _serverListFilters: readonly string[] = []
): boolean {
  void _serverListFilters;
  return (
    catalogListHasNarrowingFilters(filters) ||
    filters.sort !== "newest" ||
    (filters.city != null && filters.city.length > 0)
  );
}

/** Widen API fetch only when narrowing filters run client-side on the batch. */
export function resolveCatalogListFetchLimit(
  filters: CatalogListFilters,
  serverListFilters: readonly string[] = [],
  defaultLimit: number = CATALOG_DEFAULT_PAGE_LIMIT,
  maxLimit: number = CATALOG_API_MAX_LIMIT
): number {
  const needsWiderBatch =
    catalogListHasNarrowingFilters(filters) &&
    catalogListHasClientFilters(filters, serverListFilters);
  return needsWiderBatch ? maxLimit : defaultLimit;
}

/** Locale-agnostic list path + query (`listPath` from `resolveMarketingLocalePath`). */
export function buildCatalogListHref(
  listPath: string,
  filters: CatalogListFilters,
  cursor?: string
): string {
  return `${listPath}${buildCatalogListQuery(catalogFiltersToQueryInput(filters, cursor))}`;
}

export function catalogFiltersToQueryInput(
  filters: CatalogListFilters,
  cursor?: string
): CatalogListQueryInput {
  return {
    ...(filters.city != null && filters.city.length > 0 ? { city: filters.city } : {}),
    ...(filters.q != null && filters.q.length > 0 ? { q: filters.q } : {}),
    ...(filters.category != null && filters.category.length > 0
      ? { category: filters.category }
      : {}),
    ...(filters.difficulty != null ? { difficulty: String(filters.difficulty) } : {}),
    ...(filters.fitness != null && filters.fitness.length > 0 ? { fitness: filters.fitness } : {}),
    ...(filters.availability === "open" ? { availability: "open" } : {}),
    ...(filters.minPrice != null ? { minPrice: String(filters.minPrice) } : {}),
    ...(filters.maxPrice != null ? { maxPrice: String(filters.maxPrice) } : {}),
    ...(filters.minDuration != null ? { minDuration: String(filters.minDuration) } : {}),
    ...(filters.maxDuration != null ? { maxDuration: String(filters.maxDuration) } : {}),
    sort: filters.sort,
    ...(cursor != null && cursor.trim().length > 0 ? { cursor: cursor.trim() } : {}),
  };
}

/** Flat params for SEO noindex policy (`shouldNoindexMarketingListPage`). */
export function catalogFiltersToNoindexSearchParams(
  filters: CatalogListFilters
): Record<string, string | undefined> {
  return {
    cursor: filters.cursor,
    city: filters.city,
    q: filters.q,
    category: filters.category,
    difficulty: filters.difficulty != null ? String(filters.difficulty) : undefined,
    fitness: filters.fitness,
    availability: filters.availability,
    minPrice: filters.minPrice != null ? String(filters.minPrice) : undefined,
    maxPrice: filters.maxPrice != null ? String(filters.maxPrice) : undefined,
    minDuration: filters.minDuration != null ? String(filters.minDuration) : undefined,
    maxDuration: filters.maxDuration != null ? String(filters.maxDuration) : undefined,
    sort: filters.sort !== "newest" ? filters.sort : undefined,
  };
}

export type CatalogListFilterOmitKey =
  | "q"
  | "category"
  | "difficulty"
  | "fitness"
  | "availability"
  | "minPrice"
  | "maxPrice"
  | "minDuration"
  | "maxDuration"
  | "sort"
  | "city";

/** Build list URL with one or more filters removed (active-filter pill dismiss). */
export function buildCatalogListQueryWithoutFilters(
  filters: CatalogListFilters,
  omit: readonly CatalogListFilterOmitKey[]
): string {
  const omitSet = new Set(omit);
  const next: CatalogListFilters = {
    sort: omitSet.has("sort") ? "newest" : filters.sort,
    ...(filters.city && !omitSet.has("city") ? { city: filters.city } : {}),
    ...(filters.q && !omitSet.has("q") ? { q: filters.q } : {}),
    ...(filters.category && !omitSet.has("category") ? { category: filters.category } : {}),
    ...(filters.difficulty != null && !omitSet.has("difficulty")
      ? { difficulty: filters.difficulty }
      : {}),
    ...(filters.fitness && !omitSet.has("fitness") ? { fitness: filters.fitness } : {}),
    ...(filters.availability === "open" && !omitSet.has("availability")
      ? { availability: "open" }
      : {}),
    ...(filters.minPrice != null && !omitSet.has("minPrice") ? { minPrice: filters.minPrice } : {}),
    ...(filters.maxPrice != null && !omitSet.has("maxPrice") ? { maxPrice: filters.maxPrice } : {}),
    ...(filters.minDuration != null && !omitSet.has("minDuration")
      ? { minDuration: filters.minDuration }
      : {}),
    ...(filters.maxDuration != null && !omitSet.has("maxDuration")
      ? { maxDuration: filters.maxDuration }
      : {}),
  };
  return buildCatalogListQuery(catalogFiltersToQueryInput(next));
}

const CATALOG_SORT_I18N_KEYS: Record<CatalogListSort, string> = {
  newest: "list.filters.sort.newest",
  departure_asc: "list.filters.sort.departureAsc",
  departure_desc: "list.filters.sort.departureDesc",
  price_asc: "list.filters.sort.priceAsc",
  price_desc: "list.filters.sort.priceDesc",
  difficulty_asc: "list.filters.sort.difficultyAsc",
};

export function resolveCatalogSortFilterLabel(
  sort: CatalogListSort,
  translate: (key: string) => string
): string {
  return translate(CATALOG_SORT_I18N_KEYS[sort]);
}
