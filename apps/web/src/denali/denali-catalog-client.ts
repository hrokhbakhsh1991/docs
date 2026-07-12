import { resolveCatalogTourApiPath } from "@app-tour/workspace-sdk";

import { buildUrbanPublicTenantHeaders, resolveTourOpsApiBaseUrl } from "../urban/urban-api-base";

const DENALI_PLUGIN_ID = "denali" as const;

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
    `${resolveTourOpsApiBaseUrl()}${resolveCatalogTourApiPath(DENALI_PLUGIN_ID, tourId)}`,
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
