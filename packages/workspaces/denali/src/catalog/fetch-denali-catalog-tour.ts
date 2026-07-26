import { resolveCatalogTourApiPath } from "@app-tour/workspace-sdk";

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

export type FetchDenaliCatalogTourInput = {
  readonly tenantId: string;
  readonly tourId: string;
  readonly apiBaseUrl: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly fetchImpl?: typeof fetch;
};

/**
 * Denali public catalog tour detail — host injects API base URL + tenant headers (PSC egress).
 */
export async function fetchDenaliCatalogTour(
  input: FetchDenaliCatalogTourInput
): Promise<DenaliCatalogCard | null> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const res = await fetchImpl(
    `${input.apiBaseUrl}${resolveCatalogTourApiPath(DENALI_PLUGIN_ID, input.tourId)}`,
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
    throw new Error(`DENALI_CATALOG_TOUR_FAILED:${res.status}`);
  }
  const body = (await res.json()) as DenaliCatalogDetailResponse;
  return body.data ?? null;
}
