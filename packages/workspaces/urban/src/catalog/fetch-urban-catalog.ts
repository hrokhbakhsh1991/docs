import { resolveCatalogListApiPath, resolveCatalogTourApiPath } from "@app-tour/workspace-sdk";

const URBAN_PLUGIN_ID = "urban" as const;

const URBAN_PLUGIN_ID = "urban" as const;

export const URBAN_CATALOG_PAGE_PATH = "/catalog" as const;

export type UrbanCatalogCard = {
  readonly id: string;
  readonly title: string | null;
  readonly city: string | null;
  readonly venueName: string | null;
  readonly startDate: string | null;
  readonly endDate: string | null;
  readonly catalogSummary: string | null;
  readonly coverImageUrl: string | null;
  readonly publishedAt: string | null;
  readonly publishStatus: string | null;
};

export type UrbanCatalogListResponse = {
  readonly success: boolean;
  readonly data?: { readonly items: readonly UrbanCatalogCard[] };
  readonly metadata?: { readonly nextCursor: string | null };
};

export type UrbanCatalogDetailResponse = {
  readonly success: boolean;
  readonly data?: UrbanCatalogCard;
};

export type FetchUrbanCatalogListInput = {
  readonly tenantId: string;
  readonly apiBaseUrl: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly fetchImpl?: typeof fetch;
};

export type FetchUrbanCatalogTourInput = {
  readonly tenantId: string;
  readonly tourId: string;
  readonly apiBaseUrl: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly fetchImpl?: typeof fetch;
};

/** Urban public catalog list — host injects API base + tenant headers (Wave H.b). */
export async function fetchUrbanCatalogList(
  input: FetchUrbanCatalogListInput
): Promise<readonly UrbanCatalogCard[]> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const res = await fetchImpl(`${input.apiBaseUrl}${resolveCatalogListApiPath(URBAN_PLUGIN_ID)}`, {
    method: "GET",
    headers: input.headers ?? { "x-tenant-id": input.tenantId },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`URBAN_CATALOG_LIST_FAILED:${res.status}`);
  }
  const body = (await res.json()) as UrbanCatalogListResponse;
  return body.data?.items ?? [];
}

/** Urban public catalog tour card — host injects API base + tenant headers (Wave H.b). */
export async function fetchUrbanCatalogTour(
  input: FetchUrbanCatalogTourInput
): Promise<UrbanCatalogCard | null> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const res = await fetchImpl(
    `${input.apiBaseUrl}${resolveCatalogTourApiPath(URBAN_PLUGIN_ID, input.tourId)}`,
    {
      method: "GET",
      headers: input.headers ?? { "x-tenant-id": input.tenantId },
      cache: "no-store",
    }
  );
  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    throw new Error(`URBAN_CATALOG_DETAIL_FAILED:${res.status}`);
  }
  const body = (await res.json()) as UrbanCatalogDetailResponse;
  return body.data ?? null;
}
