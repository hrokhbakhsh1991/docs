import type { TourFormProfile } from "@repo/types";

import type { WorkspaceTourThemeSeed } from "./upsert-workspace-tour-themes";

export const URBAN_DEMO_SUBDOMAIN = "urban-demo";
export const URBAN_DEMO_TENANT_NAME = "Urban Demo";
export const URBAN_DEMO_OWNER_EMAIL = "urban-owner@urban-demo.local";
export const URBAN_DEMO_OWNER_PHONE = "+989121000002";
export const URBAN_DEMO_OWNER_PASSWORD = "demo123";

export const URBAN_DEMO_THEME_SEEDS: readonly WorkspaceTourThemeSeed[] = [
  {
    slug: "urban-demo-city-walk",
    name: "گشت شهری",
    description: "رویداد یا تور شهری تک‌مکانی — پروفایل urban_event",
    sortOrder: 10,
    formProfile: "urban_event" satisfies TourFormProfile,
  },
];
