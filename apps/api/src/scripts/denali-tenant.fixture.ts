import type { TourFormProfile } from "@repo/types";

export const DENALI_SUBDOMAIN = "denali";
export const DENALI_TENANT_NAME = "Denali";
export const DENALI_OWNER_REQUESTED_ID = "01234567890";
export const DENALI_OWNER_NATIONAL_ID = DENALI_OWNER_REQUESTED_ID.slice(0, 10);
export const DENALI_OWNER_USER_ID = "00000000-0000-4000-8000-012345678901";
export const DENALI_OWNER_EMAIL = "denali-owner@denali.platform";
export const DENALI_OWNER_PHONE = "+989121000001";

export const DENALI_PROFILE_ALIASES = {
  mountain_outdoor: "mountain_outdoor",
  nature_day_trip: "nature_trip",
  short_sessions: "cinema_event",
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
    slug: "denali-mountain-1-day",
    name: "کوه و فضای باز — یک‌روزه",
    description: "صعود یا برنامه کوهستانی تک‌روزه",
    sortOrder: 10,
    formProfile: "mountain_outdoor",
  },
  {
    slug: "denali-mountain-multi-day",
    name: "کوه و فضای باز — چندروزه",
    description: "برنامه کوهنوردی یا کمپ چندروزه",
    sortOrder: 20,
    formProfile: "mountain_outdoor",
  },
  {
    slug: "denali-nature-1-day",
    name: "طبیعت — یک‌روزه",
    description: "گشت یا پیمایش طبیعت یک‌روزه",
    sortOrder: 30,
    formProfile: "nature_trip",
  },
  {
    slug: "denali-nature-multi-day",
    name: "طبیعت — چندروزه",
    description: "سفر طبیعت‌گردی یا کمپ چندروزه",
    sortOrder: 40,
    formProfile: "nature_trip",
  },
  {
    slug: "denali-short-session-1h",
    name: "جلسه کوتاه — ۱ ساعت",
    description: "کتاب‌خوانی، فیلم، یا رویداد داخلی ~۱ ساعت",
    sortOrder: 50,
    formProfile: "cinema_event",
  },
  {
    slug: "denali-short-session-2h",
    name: "جلسه کوتاه — ۲ ساعت",
    description: "کارگاه، فیلم، یا گردهمایی ~۲ ساعت",
    sortOrder: 60,
    formProfile: "cinema_event",
  },
];
