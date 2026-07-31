export type ClampWorkspaceCatalogPageLimitOptions = {
  readonly limit?: number;
  readonly defaultLimit?: number;
  readonly maxLimit?: number;
};

/** Shared catalog list page-size clamp (DG-1.3). */
export function clampWorkspaceCatalogPageLimit(
  options: ClampWorkspaceCatalogPageLimitOptions = {},
): number {
  const defaultLimit = options.defaultLimit ?? 20;
  const maxLimit = options.maxLimit ?? 50;
  return Math.min(Math.max(options.limit ?? defaultLimit, 1), maxLimit);
}

export type WorkspaceCatalogIdCursorItem = {
  readonly id: string;
};

export type SliceWorkspaceCatalogByIdCursorResult<T extends WorkspaceCatalogIdCursorItem> = {
  readonly slice: readonly T[];
  readonly nextCursor: string | null;
};

/**
 * Cursor pagination by item `id` over an already-filtered/sorted list (DG-1.3).
 * Cursor means “start after this id”; unknown cursor → start at 0.
 */
export function sliceWorkspaceCatalogByIdCursor<T extends WorkspaceCatalogIdCursorItem>(
  items: readonly T[],
  options: {
    readonly limit: number;
    readonly cursor?: string;
  },
): SliceWorkspaceCatalogByIdCursorResult<T> {
  let startIdx = 0;
  if (options.cursor !== undefined) {
    const cursorIdx = items.findIndex((item) => item.id === options.cursor);
    if (cursorIdx >= 0) {
      startIdx = cursorIdx + 1;
    }
  }

  const slice = items.slice(startIdx, startIdx + options.limit);
  const hasMore = startIdx + slice.length < items.length;
  return {
    slice,
    nextCursor: hasMore && slice.length > 0 ? slice[slice.length - 1]!.id : null,
  };
}

/** Sequential async map (preserve order) for catalog card projection (DG-1.3). */
export async function mapWorkspaceCatalogSliceAsync<TIn, TOut>(
  slice: readonly TIn[],
  mapper: (item: TIn) => Promise<TOut>,
): Promise<TOut[]> {
  const out: TOut[] = [];
  for (const item of slice) {
    out.push(await mapper(item));
  }
  return out;
}

export type FilterWorkspacePublishedToursParams<TTour, TCanonical> = {
  readonly isPublished: (canonical: TCanonical) => boolean;
  readonly getCanonical: (tour: TTour) => TCanonical;
};

/** Filter store page items to published tours (DG-3.4). Publish predicate stays in W. */
export function filterWorkspacePublishedTours<TTour, TCanonical>(
  items: readonly TTour[],
  params: FilterWorkspacePublishedToursParams<TTour, TCanonical>,
): TTour[] {
  return items.filter((tour) => params.isPublished(params.getCanonical(tour)));
}

export type WorkspaceCatalogCursorLimitQuery = {
  readonly cursor?: string;
  readonly limit?: number;
};

/**
 * Parse shared catalog list pagination query params (DG-1.8).
 * Product-specific filters (city, difficulty, …) stay in workspace route parsers.
 */
export function parseWorkspaceCatalogCursorLimitQuery(
  url: Pick<URL, "searchParams">,
): WorkspaceCatalogCursorLimitQuery {
  const limitRaw = url.searchParams.get("limit");
  const parsedLimit = limitRaw === null ? Number.NaN : Number.parseInt(limitRaw, 10);
  const cursorRaw = url.searchParams.get("cursor");
  const cursor =
    cursorRaw === null || cursorRaw.trim().length === 0 ? undefined : cursorRaw;
  return {
    ...(cursor === undefined ? {} : { cursor }),
    ...(Number.isFinite(parsedLimit) ? { limit: parsedLimit } : {}),
  };
}

export type WorkspaceCatalogListSuccessBody<T> = {
  readonly success: true;
  readonly data: { readonly items: readonly T[] };
  readonly metadata: { readonly nextCursor: string | null };
};

/** Stable JSON envelope for public catalog list handlers (DG-1.8). */
export function buildWorkspaceCatalogListSuccessBody<T>(params: {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
}): WorkspaceCatalogListSuccessBody<T> {
  return {
    success: true,
    data: { items: params.items },
    metadata: { nextCursor: params.nextCursor },
  };
}
