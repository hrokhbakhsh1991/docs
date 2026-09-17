import { z } from "zod";

export const MARKETING_PAGE_KEY_HOME_HERO = "home-hero" as const;

export const MarketingHomeHeroPayloadSchema = z.object({
  lead: z.string().trim().min(1).max(200),
  support: z.string().trim().max(500),
  ctaPrimary: z.string().trim().min(1).max(80),
});

export type MarketingHomeHeroPayload = z.infer<typeof MarketingHomeHeroPayloadSchema>;

export const MARKETING_PAGE_LOCALES = ["fa", "en"] as const;
export type MarketingPageLocale = (typeof MARKETING_PAGE_LOCALES)[number];

export function parseMarketingPageLocale(value: string | null | undefined): MarketingPageLocale {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (normalized === "en") {
    return "en";
  }
  return "fa";
}

export function parseMarketingHomeHeroPayload(body: unknown): MarketingHomeHeroPayload {
  return MarketingHomeHeroPayloadSchema.parse(body);
}
