import type { MarketingHomeHeroPayload } from "@app-tour/marketing-pages-http-contracts";

export const MARKETING_PAGES_SETTINGS_TEST_IDS = {
  page: "marketing-pages-settings-page",
  leadInput: "marketing-pages-lead-input",
  supportInput: "marketing-pages-support-input",
  ctaInput: "marketing-pages-cta-input",
  saveDraft: "marketing-pages-save-draft",
  publish: "marketing-pages-publish",
  statusPublished: "marketing-pages-status-published",
} as const;

export type MarketingPageOperatorResponse = {
  readonly pageKey: string;
  readonly locale: "fa" | "en";
  readonly draft: MarketingHomeHeroPayload | null;
  readonly published: MarketingHomeHeroPayload | null;
  readonly publishedAt: string | null;
  readonly updatedAt: string;
};
