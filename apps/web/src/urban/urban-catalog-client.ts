import { buildUrbanPublicTenantHeaders, resolveTourOpsApiBaseUrl } from "./urban-api-base";

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

export async function fetchUrbanCatalogList(
  tenantId: string
): Promise<readonly UrbanCatalogCard[]> {
  const res = await fetch(`${resolveTourOpsApiBaseUrl()}/urban/catalog`, {
    method: "GET",
    headers: buildUrbanPublicTenantHeaders(tenantId),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`URBAN_CATALOG_LIST_FAILED:${res.status}`);
  }
  const body = (await res.json()) as UrbanCatalogListResponse;
  return body.data?.items ?? [];
}

export async function fetchUrbanCatalogTour(
  tenantId: string,
  tourId: string
): Promise<UrbanCatalogCard | null> {
  const res = await fetch(
    `${resolveTourOpsApiBaseUrl()}/urban/catalog/${encodeURIComponent(tourId)}`,
    {
      method: "GET",
      headers: buildUrbanPublicTenantHeaders(tenantId),
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
