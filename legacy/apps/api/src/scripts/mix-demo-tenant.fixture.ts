import type { WorkspaceTourThemeSeed } from "./upsert-workspace-tour-themes";

export const MIX_DEMO_SUBDOMAIN = "mix-demo";
export const MIX_DEMO_TENANT_NAME = "Mix Demo";
export const MIX_DEMO_OWNER_EMAIL = "mix-owner@mix-demo.local";
export const MIX_DEMO_OWNER_PHONE = "+989121000003";
export const MIX_DEMO_OWNER_PASSWORD = "demo123";

/** Three profiles for wizard stepper flip QA (فاز ۷.۳.۲). */
export const MIX_DEMO_THEME_SEEDS: readonly WorkspaceTourThemeSeed[] = [
  {
    slug: "mix-demo-urban",
    name: "رویداد شهری",
    description: "تم urban_event — stepper بدون itinerary/participation/logistics",
    sortOrder: 10,
    formProfile: "urban_event",
  },
  {
    slug: "mix-demo-mountain",
    name: "کوهنوردی",
    description: "تم mountain_outdoor — فیلدهای ارتفاع و سختی",
    sortOrder: 20,
    formProfile: "mountain_outdoor",
  },
  {
    slug: "mix-demo-cinema",
    name: "جلسه کوتاه",
    description: "تم cinema_event — capacity step redundant",
    sortOrder: 30,
    formProfile: "cinema_event",
  },
];

export const MIX_DEMO_DISTINCT_FORM_PROFILES = [
  "urban_event",
  "mountain_outdoor",
  "cinema_event",
] as const;
