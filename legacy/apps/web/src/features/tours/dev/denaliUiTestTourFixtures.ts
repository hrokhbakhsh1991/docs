import type { DenaliTourKind } from "@repo/types";

/** Catalog row resolved at seed time from workspace settings APIs. */
export type DenaliUiTestTourCatalog = {
  destinationId: string;
  themeId: string;
  themeName: string;
};

export type DenaliUiTestTourFixture = {
  id: string;
  title: string;
  tourType: DenaliTourKind;
  capacityMax: number;
  shortDescription: string;
  longDescription: string;
  difficultyLevel: number;
  hikingHoursApprox?: number;
  fitnessLevel?: "low" | "medium" | "high";
  sportsInsuranceRequired?: boolean;
  peakHeight?: number;
  startDateTime: string;
  endDateTime?: string;
  meetingPoint: string;
  transportMode: "none" | "organizer_vehicle" | "shared_cars";
  basePricePerPerson: number;
  /** Preferred workspace theme slugs (first match wins). */
  themeSlugs: readonly string[];
  /** Fallback slugs when Denali preset slugs are absent. */
  themeSlugFallbacks?: readonly string[];
  /** Multi-day programNature.itinerary activities (one per day). */
  itineraryDays?: readonly string[];
  customServiceLabels?: readonly string[];
  localGuideName?: string;
  minimumAge?: number;
  includesTourInsurance?: boolean;
};

/** Four realistic Persian UI-test tours mapped to Denali wizard enums. */
export const DENALI_UI_TEST_TOUR_FIXTURES: readonly DenaliUiTestTourFixture[] = [
  {
    id: "tochal-shirpla-day",
    title: "صعود یک‌روزه به قله توچال (مسیر شیرپلا)",
    tourType: "mountain_day",
    capacityMax: 15,
    shortDescription:
      "صعود تیمی به قله توچال از مسیر پاکوب شیرپلا با همراهی لیدر فدراسیون.",
    longDescription:
      "صعود تیمی به قله توچال از مسیر پاکوب شیرپلا. نیازمند کفش ساق‌دار، باتون و آمادگی جسمانی مناسب. " +
      "خدمات شامل بیمه مسئولیت مدنی و مربی فدراسیون. برنامه شامل جمع‌شدن در پایانه تله‌کابین، " +
      "حرکت در مسیر شیرپلا و بازگشت قبل از غروب.",
    difficultyLevel: 7,
    hikingHoursApprox: 7,
    fitnessLevel: "high",
    sportsInsuranceRequired: true,
    peakHeight: 3_964,
    startDateTime: "2026-10-18T05:30:00.000Z",
    meetingPoint: "ایستگاه دوّم تله‌کابین توچال — ورودی مسیر شیرپلا",
    transportMode: "none",
    basePricePerPerson: 850_000,
    themeSlugs: ["denali-mountain-1-day"],
    themeSlugFallbacks: ["mountain"],
    customServiceLabels: ["بیمه مسئولیت مدنی", "مربی فدراسیون"],
    includesTourInsurance: true,
    minimumAge: 16,
  },
  {
    id: "damavand-south-3day",
    title: "صعود ۳ روزه به جبهه جنوبی دماوند",
    tourType: "mountain_multi",
    capacityMax: 10,
    shortDescription:
      "برنامه شاخص صعود به بام ایران از جبهه جنوبی با اقامت در گوسفندسرا و بارگاه سوم.",
    longDescription:
      "برنامه شاخص صعود به بام ایران. حرکت به گوسفندسرا و صعود تا بارگاه سوم، صعود به قله و بازگشت. " +
      "نیازمند تجهیزات کامل کمپینگ ارتفاع و گواهی کارآموزی کوهپیمایی. پشتیبانی تیم پشتیبان و برنامه‌ریزی " +
      "تغذیه در ارتفاع.",
    difficultyLevel: 9,
    hikingHoursApprox: 10,
    fitnessLevel: "high",
    sportsInsuranceRequired: true,
    peakHeight: 5_610,
    startDateTime: "2026-11-05T06:00:00.000Z",
    endDateTime: "2026-11-07T18:00:00.000Z",
    meetingPoint: "میدان آزادگان — حرکت به رینه و گوسفندسرا",
    transportMode: "organizer_vehicle",
    basePricePerPerson: 4_500_000,
    themeSlugs: ["denali-mountain-multi-day"],
    themeSlugFallbacks: ["mountain"],
    itineraryDays: [
      "انتقال به رینه، پیاده‌روی تا گوسفندسرا و استقرار کمپ.",
      "صعود تا بارگاه سوم و آمادگی برای روز قله.",
      "صعود به قله دماوند (در صورت شرایط جوی مناسب) و بازگشت به تهران.",
    ],
    customServiceLabels: ["لیدر فنی", "پشتیبانی ارتفاع", "تجهیزات گروهی"],
    includesTourInsurance: true,
    minimumAge: 18,
  },
  {
    id: "elismistan-autumn-day",
    title: "پیمایش پاییزی جنگل الیمستان",
    tourType: "nature_day",
    capacityMax: 30,
    shortDescription:
      "سفر یک‌روزه به دل جنگل‌های هیرکانی و دشت الیمستان با پیاده‌روی سبک.",
    longDescription:
      "سفر به دل جنگل‌های هیرکانی و دشت الیمستان. پیاده‌روی سبک در فضای جنگلی پاییزی. " +
      "خدمات شامل وسیله نقلیه توریستی، صبحانه سلف‌سرویس و راهنمای محلی. مناسب خانواده‌ها و " +
      "علاقه‌مندان به عکاسی طبیعت.",
    difficultyLevel: 3,
    hikingHoursApprox: 4,
    fitnessLevel: "low",
    startDateTime: "2026-10-25T06:00:00.000Z",
    meetingPoint: "میدان ونک — سوار شدن در وسیله نقلیه گروه",
    transportMode: "organizer_vehicle",
    basePricePerPerson: 650_000,
    themeSlugs: ["denali-nature-1-day"],
    themeSlugFallbacks: ["nature"],
    customServiceLabels: ["صبحانه سلف‌سرویس", "راهنمای محلی", "وسیله نقلیه توریستی"],
    localGuideName: "راهنمای محلی الیمستان",
    minimumAge: 8,
  },
  {
    id: "desert-mesr-garmeh-3day",
    title: "سفر ۳ روزه به کویر مصر و گرمه",
    tourType: "desert_multi",
    capacityMax: 20,
    shortDescription:
      "شب‌نشینی در رمل‌های کویر مصر، بازدید از روستای تاریخی گرمه و تالاب گرمه.",
    longDescription:
      "شب‌نشینی دور آتش در رمل‌های کویر مصر، بازدید از روستای تاریخی گرمه و تالاب گرمه. " +
      "خدمات شامل اقامتگاه سنتی، تمام وعده‌های غذایی و لیدر کارت‌دار. برنامه مناسب عکاسی " +
      "شب و آشنایی با فرهنگ کویری.",
    difficultyLevel: 6,
    hikingHoursApprox: 3,
    fitnessLevel: "medium",
    startDateTime: "2026-12-04T07:00:00.000Z",
    endDateTime: "2026-12-06T20:00:00.000Z",
    meetingPoint: "ترمینال جنوب تهران — حرکت به سمت کویر مصر",
    transportMode: "organizer_vehicle",
    basePricePerPerson: 2_200_000,
    themeSlugs: ["denali-nature-multi-day", "denali-nature-1-day"],
    themeSlugFallbacks: ["nature"],
    itineraryDays: [
      "حرکت به کویر مصر، پیاده‌روی در رمل‌ها و شب‌نشینی.",
      "بازدید از روستای تاریخی گرمه و اقامت در اقامتگاه سنتی.",
      "بازدید از تالاب گرمه و بازگشت به تهران.",
    ],
    customServiceLabels: ["اقامتگاه سنتی", "تمام وعده‌های غذایی", "لیدر کارت‌دار"],
    minimumAge: 12,
  },
] as const;
