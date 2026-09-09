import {
  MARKETING_PAGE_KEY_HOME_HERO,
  type MarketingHomeHeroPayload,
} from "@app-tour/marketing-pages-http-contracts";

import { resolveTourOpsApiBaseUrl } from "@/env";

export type PublicMarketingPageResponse = {
  readonly pageKey: string;
  readonly locale: "fa" | "en";
  readonly published: MarketingHomeHeroPayload;
};

export async function fetchPublicMarketingHomeHero(
  host: string,
  locale: "fa" | "en",
): Promise<MarketingHomeHeroPayload | null> {
  const apiBaseUrl = resolveTourOpsApiBaseUrl();
  const url = `${apiBaseUrl.replace(/\/$/, "")}/public/marketing-pages/${MARKETING_PAGE_KEY_HOME_HERO}?locale=${locale}`;

  try {
    const response = await fetch(url, {
      headers: { "x-forwarded-host": host.split(":")[0] ?? host },
      cache: "no-store",
    });
    if (!response.ok) {
      return null;
    }
    const body = (await response.json()) as PublicMarketingPageResponse;
    return body.published ?? null;
  } catch {
    return null;
  }
}
