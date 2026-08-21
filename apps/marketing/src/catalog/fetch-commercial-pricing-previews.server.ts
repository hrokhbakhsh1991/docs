import { buildMarketingMemberApiHeaders } from "@/auth/build-marketing-member-api-headers.server";
import { resolveTourOpsApiBaseUrl } from "@/env";

import type { MarketingCommercialPricingPreview } from "./commercial-pricing-preview";

export async function fetchCommercialPricingPreviews(input: {
  readonly host: string;
  readonly tenantId: string;
  readonly workspace: string;
  readonly tourIds: readonly string[];
  readonly partySize?: number;
  readonly transportKind?: string;
}): Promise<Readonly<Record<string, MarketingCommercialPricingPreview>>> {
  const uniqueTourIds = Array.from(
    new Set(input.tourIds.map((tourId) => tourId.trim()).filter((tourId) => tourId.length > 0))
  );
  if (uniqueTourIds.length === 0) {
    return {};
  }

  const headers = await buildMarketingMemberApiHeaders({
    host: input.host,
    tenantId: input.tenantId,
  });
  if (headers.Authorization === undefined) {
    return {};
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

  try {
    const res = await fetch(`${resolveTourOpsApiBaseUrl()}/catalog/pricing-previews?${params}`, {
      method: "GET",
      headers: {
        ...headers,
        host: input.host.split(":")[0] ?? input.host,
      },
      cache: "no-store",
    });
    const body = (await res.json().catch(() => ({}))) as {
      readonly ok?: boolean;
      readonly previews?: Readonly<Record<string, MarketingCommercialPricingPreview>>;
    };
    if (!res.ok || body.ok !== true || body.previews === undefined) {
      return {};
    }
    return body.previews;
  } catch {
    return {};
  }
}
