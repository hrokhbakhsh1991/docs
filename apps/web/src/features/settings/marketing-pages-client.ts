import { MARKETING_PAGE_KEY_HOME_HERO } from "@app-tour/marketing-pages-http-contracts";

import type { MarketingPageOperatorResponse } from "./marketing-pages-types";

export async function fetchMarketingPageSettings(
  pageKey: string = MARKETING_PAGE_KEY_HOME_HERO,
  locale: "fa" | "en" = "fa",
): Promise<MarketingPageOperatorResponse> {
  const response = await fetch(
    `/api/settings/marketing-pages/${encodeURIComponent(pageKey)}?locale=${locale}`,
    { cache: "no-store" },
  );
  if (!response.ok) {
    throw new Error(`MARKETING_PAGES_HTTP_${response.status}`);
  }
  return (await response.json()) as MarketingPageOperatorResponse;
}

export async function saveMarketingPageDraft(
  payload: { lead: string; support: string; ctaPrimary: string },
  pageKey: string = MARKETING_PAGE_KEY_HOME_HERO,
  locale: "fa" | "en" = "fa",
): Promise<MarketingPageOperatorResponse> {
  const response = await fetch(
    `/api/settings/marketing-pages/${encodeURIComponent(pageKey)}?locale=${locale}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  if (!response.ok) {
    throw new Error(`MARKETING_PAGES_SAVE_${response.status}`);
  }
  return (await response.json()) as MarketingPageOperatorResponse;
}

export async function publishMarketingPage(
  pageKey: string = MARKETING_PAGE_KEY_HOME_HERO,
  locale: "fa" | "en" = "fa",
): Promise<MarketingPageOperatorResponse> {
  const response = await fetch(
    `/api/settings/marketing-pages/${encodeURIComponent(pageKey)}/publish?locale=${locale}`,
    { method: "POST" },
  );
  if (!response.ok) {
    throw new Error(`MARKETING_PAGES_PUBLISH_${response.status}`);
  }
  return (await response.json()) as MarketingPageOperatorResponse;
}
