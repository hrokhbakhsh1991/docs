import {
  resolveCatalogTourApiPath,
  type PublicCatalogTransportSnapshot,
} from "@app-tour/workspace-sdk";

import { resolveTourOpsApiBaseUrl } from "../env";

export type PortalCatalogTour = {
  readonly id: string;
  readonly title: string;
  readonly policiesText?: string | null;
  readonly nationalIdRequired?: boolean;
  readonly fatherNameRequired?: boolean;
  readonly birthDateRequired?: boolean;
  readonly priceAmount?: number | null;
  readonly transport?: PublicCatalogTransportSnapshot;
};

type CatalogDetailResponse = {
  readonly success: boolean;
  readonly data?: {
    readonly id?: string;
    readonly title?: string;
    readonly policiesText?: string | null;
    readonly nationalIdRequired?: boolean;
    readonly fatherNameRequired?: boolean;
    readonly birthDateRequired?: boolean;
    readonly priceAmount?: number | null;
    readonly transport?: PublicCatalogTransportSnapshot;
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
  return {
    id: data.id,
    title: data.title ?? "Tour",
    policiesText: data.policiesText ?? null,
    nationalIdRequired: data.nationalIdRequired === true,
    fatherNameRequired: data.fatherNameRequired === true,
    birthDateRequired: data.birthDateRequired === true,
    priceAmount: typeof data.priceAmount === "number" ? data.priceAmount : null,
    transport: data.transport,
  };
}
