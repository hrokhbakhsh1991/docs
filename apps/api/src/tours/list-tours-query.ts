export type ListToursQuery = {
  readonly limit: number;
  readonly cursor?: string;
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

const DEFAULT_LIMIT = 50;
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

export function parseListToursQuery(searchParams: URLSearchParams): ListToursQuery {
  const maxLimit = resolveTourListMaxLimit();
  const limitRaw = searchParams.get("limit");
  let limit = DEFAULT_LIMIT;
  if (limitRaw !== null && limitRaw.length > 0) {
    const parsed = Number(limitRaw);
    if (Number.isFinite(parsed) && parsed > 0) {
      limit = Math.min(Math.floor(parsed), maxLimit);
    }
  } else {
    limit = Math.min(DEFAULT_LIMIT, maxLimit);
  }

  const cursorRaw = searchParams.get("cursor")?.trim();
  const cursor = cursorRaw && cursorRaw.length > 0 ? cursorRaw : undefined;
  return { limit, cursor };
}
