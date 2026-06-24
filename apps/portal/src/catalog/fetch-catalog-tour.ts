import { resolveCatalogTourApiPath } from "@app-tour/workspace-sdk";

import { resolveTourOpsApiBaseUrl } from "../env";

export type PortalCatalogTour = {
  readonly id: string;
  readonly title: string;
  readonly policiesText?: string | null;
};

type CatalogDetailResponse = {
  readonly success: boolean;
  readonly data?: {
    readonly id?: string;
    readonly title?: string;
    readonly policiesText?: string | null;
  };
};

export async function fetchCatalogTour(input: {
  readonly tenantId: string;
  readonly pluginId: string;
  readonly tourId: string;
}): Promise<PortalCatalogTour | null> {
  const path = resolveCatalogTourApiPath(input.pluginId, input.tourId);
  const res = await fetch(`${resolveTourOpsApiBaseUrl()}${path}`, {
    method: "GET",
    headers: { "x-tenant-id": input.tenantId },
    cache: "no-store",
  });
  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    throw new Error(`PORTAL_CATALOG_DETAIL_FAILED:${res.status}`);
  }
  const body = (await res.json()) as CatalogDetailResponse;
  const data = body.data;
  if (data?.id === undefined) {
    return null;
  }
  return { id: data.id, title: data.title ?? "Tour", policiesText: data.policiesText ?? null };
}
