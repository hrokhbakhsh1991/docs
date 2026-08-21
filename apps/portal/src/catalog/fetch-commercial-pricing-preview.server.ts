import type { PortalCommercialPricingPreview } from "@/catalog/commercial-pricing-preview";
import { buildMemberApiHeaders } from "@/me/build-member-api-headers.server";
import { resolveTourOpsApiBaseUrl } from "@/env";

export async function fetchCommercialPricingPreview(input: {
  readonly host: string;
  readonly workspace: string;
  readonly tourId: string;
  readonly partySize?: number;
  readonly transportKind?: string;
}): Promise<PortalCommercialPricingPreview | null> {
  const headers = await buildMemberApiHeaders(input.host);
  if (headers.Authorization === undefined) {
    return null;
  }

  const params = new URLSearchParams({
    workspace: input.workspace,
    tourId: input.tourId,
    partySize: String(input.partySize ?? 1),
  });
  const transportKind = input.transportKind?.trim() ?? "";
  if (transportKind.length > 0) {
    params.set("transportKind", transportKind);
  }

  try {
    const res = await fetch(`${resolveTourOpsApiBaseUrl()}/catalog/pricing-preview?${params}`, {
      method: "GET",
      headers: {
        ...headers,
        host: input.host.split(":")[0] ?? input.host,
      },
      cache: "no-store",
    });
    const body = (await res.json().catch(() => ({}))) as {
      readonly ok?: boolean;
      readonly preview?: PortalCommercialPricingPreview;
    };
    if (!res.ok || body.ok !== true || body.preview === undefined) {
      return null;
    }
    return body.preview;
  } catch {
    return null;
  }
}
