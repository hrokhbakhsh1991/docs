/**
 * Inserts several rich demo tours for tenant subdomain `denali` (legacy workspace Denali).
 * **Archived:** Six Lock / Phase 7 fixtures use `ws1-rbac` — see `docs/60-operations/denali-seed-archive.md`.
 * Requires `ALLOW_DENALI_SEED=1` or the script exits without mutating data.
 *
 * Run: `ALLOW_DENALI_SEED=1 pnpm --filter @apps/api seed:denali-tours`
 */
import { DataSource } from "typeorm";

import {
  defaultTourFormProfileForTourType,
  type TourFormProfile,
} from "@repo/types";

import { createDataSourceOptionsFromEnv } from "../database/database.config";
import { DifficultyLevel, TourDetails } from "../modules/tours/entities/tour-details.entity";
import { TourEntity, TourLifecycleStatus } from "../modules/tours/entities/tour.entity";
import type { DenaliTourKind } from "@repo/types";
import type {
  TripDetailsDayPlan,
  TripDetailsLocationData,
  TourTripDetails,
} from "../modules/tours/types/tour-trip-details.types";
import { WorkspaceDestinationEntity } from "../modules/settings-locations/entities/workspace-destination.entity";
import { WorkspaceRegionEntity } from "../modules/settings-locations/entities/workspace-region.entity";
import { TenantEntity } from "../modules/identity/entities/tenant.entity";
import { UserEntity } from "../modules/identity/entities/user.entity";
import { UserTenantEntity } from "../modules/identity/entities/user-tenant.entity";
import { emitScriptInfo } from "./script-log";

const TITLE_PREFIX = "[Denali seed] ";

type TourSeedSpec = {
  title: string;
  description: string;
  tourType: TourEntity["tourType"];
  lifecycleStatus: TourLifecycleStatus;
  totalCapacity: number;
  costContext: Record<string, unknown>;
  transportModes: TourEntity["transportModes"];
  tripDetails: TourTripDetails;
  /** Denormalized tour row dates (YYYY-MM-DD) when logistics dates exist */
  startsOn?: string | null;
  endsOn?: string | null;
  /** Legacy `tour_details.duration_days` */
  durationDays?: number | null;
  difficulty?: DifficultyLevel | null;
  /**
   * Phase P9 (promptq.md): explicit `formProfile` for the seeded tour. When omitted, the
   * loop derives it via `defaultTourFormProfileForTourType(spec.tourType)` so the
   * persisted `form_profile_snapshot` column stays consistent with what the
   * `tours.service.ts` create path would emit for the same `tourType`. Set this when the
   * seed wants to pin a profile that differs from the `tourType` default (e.g. a cinema
   * event whose commercial type is left as `other`).
   */
  formProfile?: TourFormProfile;
};

function td(
  partial: TourTripDetails & { overview?: TourTripDetails["overview"] },
): TourTripDetails {
  return {
    schemaVersion: 1,
    ...partial,
  };
}

/** Structured pin for overview zones and per-day itinerary `location`. */
function seedLocation(
  addressText: string,
  latitude: number,
  longitude: number,
): TripDetailsLocationData {
  return { addressText, latitude, longitude };
}

function seedDayPlan(
  day: number,
  location: TripDetailsLocationData,
  description: string,
  extra?: Pick<TripDetailsDayPlan, "distanceKm" | "elevationGainM">,
): TripDetailsDayPlan {
  return {
    day,
    location,
    title: location.addressText,
    description,
    ...extra,
  };
}

type SeedLogisticsInput = Omit<
  NonNullable<TourTripDetails["logistics"]>,
  "meetingPoint" | "returnPoint"
>;

function seedLogistics(partial: SeedLogisticsInput): NonNullable<TourTripDetails["logistics"]> {
  return partial;
}

function seedOverview(
  partial: NonNullable<TourTripDetails["overview"]> & { denaliTourKind?: DenaliTourKind },
): NonNullable<TourTripDetails["overview"]> {
  return partial;
}

export async function seedDenaliTours(): Promise<void> {
  if (process.env.ALLOW_DENALI_SEED?.trim() !== "1") {
    emitScriptInfo(
      "Denali seed skipped (archived). Set ALLOW_DENALI_SEED=1 to run. Prefer ws1-rbac fixtures.",
    );
    return;
  }

  const ds = new DataSource({
    ...createDataSourceOptionsFromEnv(),
    entities: [
      TourEntity,
      TourDetails,
      WorkspaceDestinationEntity,
      WorkspaceRegionEntity,
      TenantEntity,
      UserEntity,
      UserTenantEntity,
    ],
  });
  await ds.initialize();
  try {
    const tenants = await ds.query<Array<{ id: string; name: string }>>(
      `SELECT id, name FROM tenants WHERE deleted_at IS NULL AND lower(trim(subdomain)) = lower(trim($1)) LIMIT 1`,
      ["denali"],
    );
    const tenant = tenants[0];
    if (!tenant) {
      console.error("No active tenant with subdomain `denali`. Create/fix subdomain first.");
      process.exitCode = 1;
      return;
    }
    const wsId = tenant.id as string;
    emitScriptInfo(`Resolved Denali workspace id=${wsId} name=${tenant.name}`);

    const destRows = await ds.query<
      Array<{ id: string; name: string; region_name: string | null }>
    >(
      `SELECT d.id, d.name, r.name AS region_name
       FROM workspace_destinations d
       JOIN workspace_regions r ON r.id = d.region_id AND r.tenant_id = d.tenant_id
       WHERE d.tenant_id = $1 AND d.is_active = true
       ORDER BY r.sort_order NULLS LAST, d.sort_order NULLS LAST, d.name ASC
       LIMIT 1`,
      [wsId],
    );
    const dest = destRows[0];
    if (dest) {
      emitScriptInfo(`Using workspace destination id=${dest.id} name=${dest.name}`);
    } else {
      emitScriptInfo("No workspace destinations — tours will have null destination_id.");
    }

    const ownerRows = await ds.query<Array<{ user_id: string }>>(
      `SELECT ut.user_id AS user_id
       FROM user_tenants ut
       WHERE ut.tenant_id = $1
         AND ut.deleted_at IS NULL
         AND ut.membership_status = 'ACTIVE'
       ORDER BY ut.joined_at ASC NULLS LAST
       LIMIT 1`,
      [wsId],
    );
    const ownerId = ownerRows[0]?.user_id ?? null;
    if (ownerId) {
      emitScriptInfo(`Attaching created_by_user_id=${ownerId}`);
    }

    const themes = await ds.query<Array<{ id: string }>>(
      `SELECT id FROM workspace_tour_themes WHERE workspace_id = $1 AND is_active = true ORDER BY sort_order ASC, name ASC LIMIT 2`,
      [wsId],
    );
    const themeIds = themes.map((r) => r.id);

    const gatherLabel = dest ? `${dest.name} — میدان اصلی` : "محل قرار اعلام می‌شود";
    const tehranGather = seedLocation("تهران — میدان آزادی", 35.6997, 51.3381);
    const natureGather = seedLocation(gatherLabel, 35.72, 51.42);
    const natureTrail = seedLocation(
      dest ? `${dest.name} — مسیر جنگلی` : "مسیر پیاده‌روی",
      36.12,
      51.38,
    );
    const natureCamp = seedLocation(
      dest ? `${dest.name} — اقامتگاه` : "اقامتگاه گروهی",
      36.15,
      51.35,
    );
    const tochalParking = seedLocation("پارکینگ اول توچال", 35.825, 51.002);
    const damavandGather = seedLocation("میدان آزادی — پارکینگ جنوبی", 35.6997, 51.3381);
    const damavandCamp = seedLocation("کمپ سوم دماوند", 35.954, 52.109);
    const damavandSummit = seedLocation("قله دماوند", 35.955, 52.109);
    const cafeVenue = seedLocation("کافهٔ قرار (آدرس دقیق در کانال)", 35.75, 51.41);
    const cinemaLobby = seedLocation("لابی پردیس سینمایی (اعلام نهایی)", 35.76, 51.4);
    const mafiaVenue = seedLocation("فضای رویداد (آدرس خصوصی برای ثبت‌نام‌شدگان)", 35.74, 51.43);

    const tourRepo = ds.getRepository(TourEntity);

    const del = await tourRepo
      .createQueryBuilder()
      .delete()
      .where("tenant_id = :wsId AND title LIKE :pfx", { wsId, pfx: `${TITLE_PREFIX}%` })
      .execute();
    emitScriptInfo(`Removed prior seeded tours (matched rows): ${del.affected ?? 0}`);

    const commonPolicies: TourTripDetails["policies"] = {
      cancellationPolicy: "تا ۷ روز قبل از تاریخ حرکت: استرداد کامل منهای کارمزد.",
      refundPolicy: "در صورت لغو از سوی برگزارکننده، مبلغ کامل عودت داده می‌شود.",
      safetyPolicy: "شرکت‌کنندگان موظف به رعایت دستورات لیدر و تجهیزات ایمنی هستند.",
      weatherPolicy: "در شرایط جوی خطرناک، برنامه ممکن است به‌صورت اضطراری تغییر کند.",
    };

    const specs: TourSeedSpec[] = [
      {
        title: `${TITLE_PREFIX}طبیعت‌گردی البرز — دو شب اقامت`,
        description:
          "پیاده‌روی جنگلی، آبشارهای منطقه، شب‌مانی در اقامتگاه محلی. مناسب خانواده‌ها و علاقه‌مندان به عکاسی طبیعت.",
        tourType: "nature",
        lifecycleStatus: TourLifecycleStatus.OPEN,
        totalCapacity: 22,
        costContext: { currency: "USD", totalCost: 189 },
        transportModes: ["bus"],
        startsOn: "2026-06-12",
        endsOn: "2026-06-14",
        durationDays: 3,
        difficulty: DifficultyLevel.EASY,
        tripDetails: td({
          overview: seedOverview({
            denaliTourKind: "nature_multi",
            shortIntro: "سه روز در جنگل و دامنه‌های البرز با اقامت گروهی.",
            tripStyles: ["photography", "familyFriendly"],
            tourThemeIds: themeIds.length ? themeIds : undefined,
            maxAltitudeMeters: 2800,
            gatheringPoint: natureGather,
            startPoint: natureTrail,
            campPoint: natureCamp,
            endPoint: tehranGather,
          }),
          itinerary: {
            highlights: ["پیاده‌روی جنگلی", "شب‌نشینی دور آتش", "عکاسی از منظره"],
            dayPlans: [
              seedDayPlan(
                1,
                natureGather,
                "جمع‌شدن، معرفی مسیر، پیاده‌روی ۳ ساعته در مسیر جنگلی.",
              ),
              seedDayPlan(2, natureTrail, "صبح زود حرکت؛ مسیر متوسط؛ استراحت طولانی ظهر."),
              seedDayPlan(3, tehranGather, "صبحانه، جمع‌کردن کمپ، بازگشت به تهران."),
            ],
          },
          participation: {
            minimumAge: 10,
            fitnessLevel: DifficultyLevel.EASY,
            experienceLevel: "basic",
            suitableFor: ["families", "beginners"],
            notSuitableFor: ["experienced_hikers"],
            requirements: "کفش کوه‌پیمایی، بطری آب، لباس گرم.",
          },
          logistics: seedLogistics({
            departureDate: "2026-06-12",
            returnDate: "2026-06-14",
            departureMeetingTime: "06:30",
            includedServices: ["ناهار روز دوم", "میان‌وعده", "راهنما"],
            excludedServices: ["شام شب اول", "بیمه مسافرتی"],
            mealPlan: "self_catering",
            groupSizeMin: 8,
            groupSizeMax: 22,
          }),
          policies: commonPolicies,
        }),
      },
      {
        title: `${TITLE_PREFIX}کوهنوردی یک‌روزه — توچال (مسیر متوسط)`,
        description: "صعود یک‌روزه با تله‌کابین و پیاده‌روی سنگ‌فرش تا ایستگاه ۵؛ مناسب آمادگی جسمانی متوسط.",
        tourType: "mountain",
        lifecycleStatus: TourLifecycleStatus.OPEN,
        totalCapacity: 16,
        costContext: { currency: "USD", totalCost: 45 },
        transportModes: ["private_car"],
        startsOn: "2026-05-24",
        endsOn: "2026-05-24",
        durationDays: 1,
        difficulty: DifficultyLevel.MODERATE,
        tripDetails: td({
          overview: seedOverview({
            denaliTourKind: "mountain_day",
            shortIntro: "یک روز در ارتفاع با منظرهٔ تهران.",
            tripStyles: ["adventure", "budget"],
            tourThemeIds: themeIds.length ? [themeIds[0]] : undefined,
            elevationGainMeters: 650,
            gatheringPoint: tochalParking,
            startPoint: tochalParking,
            endPoint: tochalParking,
          }),
          itinerary: {
            dayPlans: [
              seedDayPlan(
                1,
                tochalParking,
                "قرار صبح زود، تله‌کابین، پیاده‌روی تا ایستگاه ۵، ناهار، بازگشت عصر.",
                { distanceKm: 8, elevationGainM: 650 },
              ),
            ],
          },
          participation: {
            fitnessLevel: DifficultyLevel.MODERATE,
            experienceLevel: "basic",
            suitableFor: ["solo_travelers", "beginners"],
            requirements: "عینک آفتابی، کلاه، ۱٫۵ لیتر آب.",
          },
          logistics: seedLogistics({
            departureDate: "2026-05-24",
            returnDate: "2026-05-24",
            departureMeetingTime: "05:45",
            transportationNotes: "خودروهای شخصی؛ دنگ بنزین بین سرنشینان.",
            groupSizeMin: 4,
            groupSizeMax: 16,
          }),
          policies: commonPolicies,
        }),
      },
      {
        title: `${TITLE_PREFIX}صعود دماوند — برنامهٔ سه‌روزه`,
        description:
          "پلکان، کمپ سوم، سامیت؛ آکلیماسیون و ریتم محافظه‌کارانه. فقط برای کوهنوردان با سابقهٔ صعود چندقله بالای ۴۰۰۰ متر.",
        tourType: "mountain",
        lifecycleStatus: TourLifecycleStatus.DRAFT,
        totalCapacity: 10,
        costContext: { currency: "USD", totalCost: 420 },
        transportModes: ["bus"],
        startsOn: "2026-07-03",
        endsOn: "2026-07-05",
        durationDays: 3,
        difficulty: DifficultyLevel.HARD,
        tripDetails: td({
          overview: seedOverview({
            denaliTourKind: "mountain_multi",
            shortIntro: "برنامهٔ فشردهٔ سه‌روزه با شب‌مانی در کمپ.",
            tripStyles: ["adventure"],
            tourThemeIds: themeIds.length ? themeIds : undefined,
            maxAltitudeMeters: 5610,
            elevationGainMeters: 2700,
            gatheringPoint: damavandGather,
            startPoint: seedLocation("پلکان دماوند", 35.951, 52.109),
            campPoint: damavandCamp,
            summitPoint: damavandSummit,
            endPoint: damavandGather,
          }),
          itinerary: {
            highlights: ["آکلیماسیون", "کمپ سوم", "قله در صورت مساعد بودن هوا"],
            dayPlans: [
              seedDayPlan(
                1,
                seedLocation("پلکان → گوسفندسرا", 35.951, 52.109),
                "انتقال، پیاده‌روی سبک، استراحت.",
              ),
              seedDayPlan(2, damavandCamp, "صعود با بار سبک؛ شب در کمپ."),
              seedDayPlan(3, damavandSummit, "شروع نیمه‌شب؛ بازگشت به پلکان."),
            ],
          },
          participation: {
            fitnessLevel: DifficultyLevel.HARD,
            experienceLevel: "advanced",
            technicalSkillRequired: "کار با crampon و یخ‌شکن در صورت یخبندان.",
            sportsInsuranceRequired: true,
            suitableFor: ["experienced_hikers"],
            notSuitableFor: ["beginners", "kids"],
            requirements: "گواهی صعود یا معرفی لیدر قبلی.",
          },
          logistics: seedLogistics({
            departureDate: "2026-07-03",
            returnDate: "2026-07-05",
            departureMeetingTime: "04:00",
            accommodationNotes: "چادر گروهی در کمپ سوم.",
            includedServices: ["ناهار بسته‌بندی روز دوم", "راهنما", "پشتیبان"],
            excludedServices: ["چادر شخصی", "گرمایش"],
            groupSizeMin: 6,
            groupSizeMax: 10,
          }),
          policies: {
            ...commonPolicies,
            weatherPolicy: "با باد شدید یا طوفان، صعود لغو و برنامه جایگزین اعلام می‌شود.",
          },
        }),
      },
      {
        title: `${TITLE_PREFIX}کلوپ کتاب — رمان معاصر (شهر)`,
        description: "جلسهٔ بحث آزاد روی یک رمان انتخابی؛ فنجان قهوه و نوت‌برداری. بدون نیاز به تجهیزات کوه.",
        tourType: "cultural",
        lifecycleStatus: TourLifecycleStatus.OPEN,
        totalCapacity: 14,
        costContext: { currency: "USD", totalCost: 12 },
        transportModes: ["bus"],
        startsOn: "2026-05-30",
        endsOn: "2026-05-30",
        durationDays: 1,
        difficulty: DifficultyLevel.EASY,
        tripDetails: td({
          overview: seedOverview({
            denaliTourKind: "event_reading",
            shortIntro: "یک عصر کتاب و گفت‌وگو در فضای آرام.",
            tripStyles: ["relaxed", "budget"],
            gatheringPoint: cafeVenue,
            endPoint: cafeVenue,
          }),
          itinerary: {
            outline: "معرفی کتاب ۲۰ دقیقه؛ بحث آزاد ۹۰ دقیقه؛ جمع‌بندی.",
            dayPlans: [
              seedDayPlan(
                1,
                cafeVenue,
                "فصل‌های ۱–۳؛ سوالات از پیش اعلام‌شده در کانال.",
              ),
            ],
          },
          participation: {
            minimumAge: 16,
            fitnessLevel: DifficultyLevel.EASY,
            experienceLevel: "none",
            suitableFor: ["solo_travelers", "seniors"],
            requirements: "خواندن فصل‌های مشخص تا قبل از جلسه.",
          },
          logistics: seedLogistics({
            departureDate: "2026-05-30",
            returnDate: "2026-05-30",
            departureMeetingTime: "16:00",
            includedServices: ["فضای نشست", "تسهیلگر"],
            excludedServices: ["نوشیدنی"],
            groupSizeMin: 6,
            groupSizeMax: 14,
          }),
          policies: commonPolicies,
        }),
      },
      {
        title: `${TITLE_PREFIX}سینما — نمایش ویژه + نقد`,
        description: "بلیت گروهی، سالن اختصاصی یا سانس ویژه، نیم ساعت نقد پس از فیلم.",
        tourType: "city",
        lifecycleStatus: TourLifecycleStatus.OPEN,
        totalCapacity: 40,
        costContext: { currency: "USD", totalCost: 22 },
        transportModes: ["bus"],
        startsOn: "2026-06-06",
        endsOn: "2026-06-06",
        durationDays: 1,
        difficulty: DifficultyLevel.EASY,
        tripDetails: td({
          overview: seedOverview({
            denaliTourKind: "event_cinema",
            shortIntro: "فیلم، پاپ‌کورن اختیاری، گفت‌وگوی کوتاه.",
            tripStyles: ["relaxed", "familyFriendly"],
            gatheringPoint: cinemaLobby,
            endPoint: cinemaLobby,
          }),
          itinerary: {
            dayPlans: [
              seedDayPlan(1, cinemaLobby, "سانس ویژه و نقد پس از نمایش."),
            ],
          },
          logistics: seedLogistics({
            departureDate: "2026-06-06",
            returnDate: "2026-06-06",
            departureMeetingTime: "19:00",
            transportationNotes: "اتوبوس ترانسفر رفت از نقطهٔ مشخص.",
            groupSizeMin: 20,
            groupSizeMax: 40,
          }),
          participation: {
            suitableFor: ["families", "solo_travelers"],
          },
          policies: commonPolicies,
        }),
      },
      {
        title: `${TITLE_PREFIX}بازی مافیا — شب گروهی`,
        description: "میزهای ۱۲–۱۵ نفره، داور و سناریوهای متنوع؛ فقط برای بزرگسالان.",
        tourType: "city",
        lifecycleStatus: TourLifecycleStatus.OPEN,
        totalCapacity: 24,
        costContext: { currency: "USD", totalCost: 8 },
        transportModes: ["bus"],
        startsOn: "2026-06-13",
        endsOn: "2026-06-13",
        durationDays: 1,
        difficulty: DifficultyLevel.EASY,
        tripDetails: td({
          overview: seedOverview({
            denaliTourKind: "event_reading",
            shortIntro: "شب بازی گروهی با فضای امن و قوانین روشن.",
            tripStyles: ["relaxed", "budget"],
            gatheringPoint: mafiaVenue,
            endPoint: mafiaVenue,
          }),
          itinerary: {
            dayPlans: [
              seedDayPlan(
                1,
                mafiaVenue,
                "آموزش قوانین ۱۵ دقیقه؛ ۴ راند بازی؛ استراحت میانی.",
              ),
            ],
          },
          participation: {
            minimumAge: 18,
            fitnessLevel: DifficultyLevel.EASY,
            experienceLevel: "none",
            suitableFor: ["solo_travelers", "beginners"],
            requirements: "رعایت احترام متقابل؛ تلفن همراه روی حالت سکوت.",
          },
          logistics: seedLogistics({
            departureDate: "2026-06-13",
            returnDate: "2026-06-13",
            departureMeetingTime: "20:00",
            groupSizeMin: 12,
            groupSizeMax: 24,
          }),
          policies: {
            ...commonPolicies,
            reservationRules: "ثبت‌نام قطعی تا ۴۸ ساعت قبل؛ جایگزینی با هماهنگی لیدر.",
          },
        }),
      },
    ];

    let inserted = 0;
    for (const spec of specs) {
      const details = ds.getRepository(TourDetails).create({
        destinationName: dest?.name ?? null,
        elevationM: spec.tripDetails.overview?.maxAltitudeMeters ?? null,
        difficulty: spec.difficulty ?? null,
        durationDays: spec.durationDays ?? null,
        meetingPoint: spec.tripDetails.overview?.gatheringPoint?.addressText ?? null,
        itinerary: null,
        tripDetails: spec.tripDetails,
      });

      const resolvedFormProfile =
        spec.formProfile ?? defaultTourFormProfileForTourType(spec.tourType ?? null);

      const tour = tourRepo.create({
        tenantId: wsId,
        title: spec.title,
        description: spec.description,
        totalCapacity: spec.totalCapacity,
        acceptedCount: 0,
        lifecycleStatus: spec.lifecycleStatus,
        chatLink: "https://t.me/+DenaliSeedPlaceholder",
        costContext: spec.costContext,
        autoAcceptRegistrations: true,
        tourType: spec.tourType,
        transportModes: spec.transportModes,
        startsOn: spec.startsOn ?? null,
        endsOn: spec.endsOn ?? null,
        destination: dest ? ({ id: dest.id } as WorkspaceDestinationEntity) : null,
        createdByUserId: ownerId ?? null,
        formProfileSnapshot: resolvedFormProfile,
        details,
      });

      await tourRepo.save(tour);
      inserted += 1;
    }

    emitScriptInfo(`Inserted ${inserted} seeded tours for denali (tenant_id=${wsId}).`);
  } finally {
    await ds.destroy();
  }
}

seedDenaliTours().catch((error: unknown) => {
  console.error("seed-denali-tours failed:", error);
  process.exitCode = 1;
});
