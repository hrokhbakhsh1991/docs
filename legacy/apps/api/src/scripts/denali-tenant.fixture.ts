import type { TourFormProfile } from "@repo/types";

export const DENALI_SUBDOMAIN = "denali";
export const DENALI_TENANT_NAME = "Denali";
export const DENALI_OWNER_REQUESTED_ID = "01234567890";
export const DENALI_OWNER_NATIONAL_ID = DENALI_OWNER_REQUESTED_ID.slice(0, 10);
export const DENALI_OWNER_USER_ID = "00000000-0000-4000-8000-012345678901";
export const DENALI_OWNER_EMAIL = "denali-owner@denali.platform";
export const DENALI_OWNER_PHONE = "+989121000001";

export const DENALI_PROFILE_ALIASES = {
  mountain_outdoor: "denali_pilot",
  nature_day_trip: "denali_pilot",
  short_sessions: "denali_pilot",
} as const satisfies Record<string, TourFormProfile>;

export type DenaliThemeSeed = {
  slug: string;
  name: string;
  description: string;
  sortOrder: number;
  formProfile: TourFormProfile;
};

export const DENALI_THEME_SEEDS: readonly DenaliThemeSeed[] = [
  {
    slug: "nature",
    name: "طبیعت‌گردی",
    description: "طبیعت‌گردی",
    sortOrder: 10,
    formProfile: "denali_pilot",
  },
  {
    slug: "mountain",
    name: "کوهنوردی",
    description: "کوهنوردی",
    sortOrder: 20,
    formProfile: "denali_pilot",
  },
];
