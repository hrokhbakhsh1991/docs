import type { MarketingHomeHeroPayload } from "@app-tour/marketing-pages-http-contracts";

export const MARKETING_PAGES_SETTINGS_TEST_IDS = {
  page: "marketing-pages-settings-page",
  localeTabs: "marketing-pages-locale-tabs",
  localeTab: (locale: "fa" | "en") => `marketing-pages-locale-tab-${locale}`,
  readOnlyBanner: "marketing-pages-read-only-banner",
  leadInput: "marketing-pages-lead-input",
  supportInput: "marketing-pages-support-input",
  ctaInput: "marketing-pages-cta-input",
  saveDraft: "marketing-pages-save-draft",
  publish: "marketing-pages-publish",
  statusPublished: "marketing-pages-status-published",
  savedDraft: "marketing-pages-saved-draft",
  savedPublished: "marketing-pages-saved-published",
  validationError: "marketing-pages-validation-error",
} as const;

export type MarketingPageOperatorResponse = {
  readonly pageKey: string;
  readonly locale: "fa" | "en";
  readonly draft: MarketingHomeHeroPayload | null;
  readonly published: MarketingHomeHeroPayload | null;
  readonly publishedAt: string | null;
  readonly updatedAt: string;
};
