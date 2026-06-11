import { buildUrbanPublicTenantHeaders, resolveTourOpsApiBaseUrl } from "../urban/urban-api-base";

export type DenaliCatalogCard = {
  readonly id: string;
  readonly title: string;
  readonly shortDescription: string | null;
  readonly departureAt: string | null;
};

type DenaliCatalogDetailResponse = {
  readonly success: boolean;
  readonly data?: DenaliCatalogCard;
};

export async function fetchDenaliCatalogTour(
  tenantId: string,
  tourId: string
): Promise<DenaliCatalogCard | null> {
  const res = await fetch(
    `${resolveTourOpsApiBaseUrl()}/denali/catalog/${encodeURIComponent(tourId)}`,
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
    throw new Error(`DENALI_CATALOG_TOUR_FAILED:${res.status}`);
  }
  const body = (await res.json()) as DenaliCatalogDetailResponse;
  return body.data ?? null;
}
