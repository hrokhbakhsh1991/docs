import { buildMarketingMemberApiHeaders } from "@/auth/build-marketing-member-api-headers.server";
import { resolveTourOpsApiBaseUrl } from "@/env";

import type { MarketingCommercialPricingPreview } from "./commercial-pricing-preview";

export type MarketingCommercialPricingPreviewStatus =
  | "anonymous"
  | "available"
  | "partial"
  | "unavailable";

export type MarketingCommercialPricingPreviewsResult = {
  readonly previews: Readonly<Record<string, MarketingCommercialPricingPreview>>;
  readonly status: MarketingCommercialPricingPreviewStatus;
};

export async function fetchCommercialPricingPreviews(input: {
  readonly host: string;
  readonly tenantId: string;
  readonly workspace: string;
  readonly tourIds: readonly string[];
  readonly partySize?: number;
  readonly transportKind?: string;
}): Promise<MarketingCommercialPricingPreviewsResult> {
  const uniqueTourIds = Array.from(
    new Set(input.tourIds.map((tourId) => tourId.trim()).filter((tourId) => tourId.length > 0))
  );
  if (uniqueTourIds.length === 0) {
    return { previews: {}, status: "anonymous" };
  }

  const headers = await buildMarketingMemberApiHeaders({
    host: input.host,
    tenantId: input.tenantId,
  });
  if (headers.Authorization === undefined) {
    return { previews: {}, status: "anonymous" };
  }

  const params = new URLSearchParams({
    workspace: input.workspace,
    partySize: String(input.partySize ?? 1),
  });
  for (const tourId of uniqueTourIds) {
    params.append("tourId", tourId);
  }
  const transportKind = input.transportKind?.trim() ?? "";
  if (transportKind.length > 0) {
    params.set("transportKind", transportKind);
  }

  const requestPreviews = async (
    requestedTourIds: readonly string[]
  ): Promise<Readonly<Record<string, MarketingCommercialPricingPreview>> | null> => {
    const requestParams = new URLSearchParams(params);
    requestParams.delete("tourId");
    for (const tourId of requestedTourIds) {
      requestParams.append("tourId", tourId);
    }

    try {
      const res = await fetch(
        `${resolveTourOpsApiBaseUrl()}/catalog/pricing-previews?${requestParams}`,
        {
          method: "GET",
          headers: {
            ...headers,
            host: input.host.split(":")[0] ?? input.host,
          },
          cache: "no-store",
        }
      );
      const body = (await res.json().catch(() => ({}))) as {
        readonly ok?: boolean;
        readonly previews?: Readonly<Record<string, MarketingCommercialPricingPreview>>;
      };
      return res.ok && body.ok === true && body.previews !== undefined ? body.previews : null;
    } catch {
      return null;
    }
  };

  try {
    const batchPreviews = await requestPreviews(uniqueTourIds);
    const missingTourIds = uniqueTourIds.filter(
      (tourId) => batchPreviews?.[tourId] === undefined
    );
    if (missingTourIds.length === 0) {
      return { previews: batchPreviews ?? {}, status: "available" };
    }

    const recovered = await Promise.all(
      missingTourIds.map(async (tourId) => {
        const previews = await requestPreviews([tourId]);
        return previews?.[tourId] === undefined ? null : ([tourId, previews[tourId]] as const);
      })
    );
    const previews = { ...(batchPreviews ?? {}) };
    for (const entry of recovered) {
      if (entry !== null) {
        previews[entry[0]] = entry[1];
      }
    }

    const previewCount = Object.keys(previews).length;
    return {
      previews,
      status: previewCount === uniqueTourIds.length ? "available" : "partial",
    };
  } catch {
    return { previews: {}, status: "unavailable" };
  }
}
