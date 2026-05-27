import {
  denaliCanonicalBasicsFromTourKind,
  denaliTourKindToIsMultiDay,
  inferDenaliTransportModeFromApiLogistics,
  isDenaliMountainCategory,
  isDenaliTourKind,
  type DenaliTourKind,
} from "@repo/types";
import {
  gatheringPickupStationFromLegacyLocation,
  normalizeGatheringPickupStations,
} from "@repo/types";
import {
  denaliLocationFromApi,
  denaliLocationFromText,
  type DenaliLocationData,
} from "@repo/types/denali";

import { readTourMinRequiredPeaks } from "@/features/tours/domain/peak-experience";
import {
  gearCatalogIdsToGearItems,
  normalizeGearItems,
} from "@/features/tours/wizard/denali/denaliGearSelection";
import type { DenaliGearItem } from "@/features/tours/wizard/schemas/denaliGearItemSchema";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliTourCreateSchema";
import { normalizeDenaliWizardForm } from "@/features/tours/wizard/denali/validation/denaliRuleAccess";
import { combineYmdAndTimeToIso } from "@/features/tours/wizard/denali/denaliDatetime";

import type { TourCloneSourceDto } from "./transformTourToWizardValues";

/** New-tour wizard hydration only — clone path leaves API values unchanged. */
export type DenaliWizardTourTransformMode = "clone" | "create";

export type TransformTourToDenaliWizardOptions = {
  /**
   * `clone` (default): clone/edit mapping; gear filtered to `activeEquipmentIds` when provided.
   * `create`: new Denali wizard — mountain submit defaults (gear uses same catalog filter).
   */
  mode?: DenaliWizardTourTransformMode;
  /**
   * When true, keep gallery photo ids from the API (edit hydrate). Clone flow remints ids by default.
   */
  preserveGalleryPhotoIds?: boolean;
  /**
   * Workspace active equipment row ids (`useSettingsEquipment` rows with `isActive`).
   * When set, gear from the source tour is filtered to this catalog (clone + create).
   */
  activeEquipmentIds?: readonly string[];
};

/** Mountain altitude fallback for create mode (canonical gate requires a positive integer). */
const CREATE_MOUNTAIN_ALTITUDE_FALLBACK_M = 1;

const LEGACY_FITNESS_TO_DENALI: Record<string, DenaliCreateTourWizardForm["participantRequirements"]["fitnessLevel"]> =
  {
    easy: "low",
    moderate: "medium",
    hard: "high",
    technical: "high",
  };

function strOrEmpty(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((x): x is string => typeof x === "string");
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function readThemeIds(tourThemeIds: unknown): string[] {
  return stringArray(tourThemeIds).filter((id) => id.trim().length > 0);
}

function readOverviewCustomServiceLabels(overview: Record<string, unknown>): string[] {
  return stringArray(overview.customServiceLabels)
    .map((label) => label.trim())
    .filter((label) => label.length > 0);
}

function readOverviewNonAttendanceDetails(
  overview: Record<string, unknown>,
): string | undefined {
  const raw = overview.nonAttendanceDetails;
  if (typeof raw !== "string") {
    return undefined;
  }
  const trimmed = raw.trim();
  return trimmed === "" ? undefined : trimmed;
}

function ratingToDenaliDifficulty(
  rating: unknown,
): number {
  if (typeof rating !== "number" || !Number.isFinite(rating)) return 5;
  return Math.min(10, Math.max(1, rating));
}

function parseHikingHoursFromProgramNotes(notes: unknown): number | undefined {
  if (typeof notes !== "string") return undefined;
  const m = notes.match(/مدت تقریبی پیاده‌روی:\s*(\d+(?:\.\d+)?)/);
  if (!m?.[1]) return undefined;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : undefined;
}

function parseHikingGoReturnFromProgramNotes(notes: unknown): {
  hikingGoHours?: number;
  hikingReturnHours?: number;
} {
  if (typeof notes !== "string") return {};
  const go =
    notes.match(/رفت:\s*(\d+(?:\.\d+)?)/) ?? notes.match(/صعود:\s*(\d+(?:\.\d+)?)/);
  const ret =
    notes.match(/برگشت:\s*(\d+(?:\.\d+)?)/) ?? notes.match(/فرود:\s*(\d+(?:\.\d+)?)/);
  const hikingGoHours =
    go?.[1] != null && Number.isFinite(Number(go[1])) ? Number(go[1]) : undefined;
  const hikingReturnHours =
    ret?.[1] != null && Number.isFinite(Number(ret[1])) ? Number(ret[1]) : undefined;
  return { hikingGoHours, hikingReturnHours };
}

function remintClonePhotoId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function mapDayPlanPhotos(
  raw: unknown,
  options?: { preserveIds?: boolean },
): Array<{
  id: string;
  url: string;
  filename?: string;
  size?: number;
  mimeType?: string;
  uploadedAt?: string;
}> | undefined {
  if (!Array.isArray(raw)) return undefined;
  const mapped = raw
    .filter((p) => p && typeof p === "object")
    .map((p) => {
      const row = p as Record<string, unknown>;
      const url = typeof row.url === "string" ? row.url.trim() : "";
      if (!url) return null;
      const apiId = typeof row.id === "string" ? row.id.trim() : "";
      const id =
        options?.preserveIds === true && apiId.length > 0 ? apiId : remintClonePhotoId();
      return {
        id,
        url,
        ...(typeof row.filename === "string" ? { filename: row.filename } : {}),
        ...(typeof row.size === "number" ? { size: row.size } : {}),
        ...(typeof row.mimeType === "string" ? { mimeType: row.mimeType } : {}),
        ...(typeof row.uploadedAt === "string" ? { uploadedAt: row.uploadedAt } : {}),
      };
    })
    .filter((p): p is NonNullable<typeof p> => p != null);
  return mapped.length > 0 ? mapped : undefined;
}

type DenaliItineraryDayMapped = {
  day: number;
  locationText?: string;
  location?: DenaliLocationData;
  activities: string;
  photos?: ReturnType<typeof mapDayPlanPhotos>;
};

function mapApiDayPlanToDenaliRow(
  plan: Record<string, unknown>,
  index: number,
): DenaliItineraryDayMapped {
  const day =
    typeof plan.day === "number" && Number.isFinite(plan.day)
      ? plan.day
      : typeof plan.dayNumber === "number" && Number.isFinite(plan.dayNumber)
        ? plan.dayNumber
        : index + 1;
  const title = strOrEmpty(plan.title);
  const description = strOrEmpty(plan.description) || strOrEmpty(plan.activities);
  const structuredLocation = denaliLocationFromApi(plan.location);
  const photos = mapDayPlanPhotos(plan.photos);
  const locationText = structuredLocation?.addressText?.trim() || title || undefined;
  return {
    day,
    locationText,
    ...(structuredLocation ? { location: structuredLocation } : {}),
    activities: description,
    ...(photos != null ? { photos } : {}),
  };
}

/** Prefer `dayPlans`, then legacy `days`, then `segmentActivities` with per-segment location. */
function readDenaliItineraryDayPlans(itinerary: Record<string, unknown>): DenaliItineraryDayMapped[] {
  const dayPlans = Array.isArray(itinerary.dayPlans) ? itinerary.dayPlans : [];
  if (dayPlans.length > 0) {
    return dayPlans.map((row, index) => mapApiDayPlanToDenaliRow(asObject(row), index));
  }

  const days = Array.isArray(itinerary.days) ? itinerary.days : [];
  if (days.length > 0) {
    return days.map((row, index) => mapApiDayPlanToDenaliRow(asObject(row), index));
  }

  const segmentActivities = Array.isArray(itinerary.segmentActivities)
    ? itinerary.segmentActivities
    : [];
  if (segmentActivities.length === 0) {
    return [];
  }

  return segmentActivities.map((raw, index) => {
    const day = asObject(raw);
    const segments = Array.isArray(day.segments) ? day.segments : [];
    const seg0 = segments[0] ? asObject(segments[0]) : {};
    const locationName = strOrEmpty(seg0.locationName);
    const segmentLocation =
      denaliLocationFromApi(seg0.location) ??
      (locationName ? denaliLocationFromText(locationName) : undefined);
    return mapApiDayPlanToDenaliRow(
      {
        day: day.dayNumber,
        title: strOrEmpty(day.title) || locationName,
        description: strOrEmpty(day.description),
        location: segmentLocation,
        photos: day.photos,
      },
      index,
    );
  });
}

function isMultiDayFromLogistics(logistics: Record<string, unknown>): boolean {
  const dep = strOrEmpty(logistics.departureDate);
  const ret = strOrEmpty(logistics.returnDate);
  if (!dep || !ret || dep === ret) return false;
  return true;
}

function inferDenaliTourKind(
  overview: Record<string, unknown>,
  apiTourType: string,
  logistics: Record<string, unknown>,
): DenaliTourKind {
  const stored = overview.denaliTourKind;
  if (isDenaliTourKind(stored)) {
    return stored;
  }
  const multi = isMultiDayFromLogistics(logistics);
  switch (apiTourType) {
    case "mountain":
      return multi ? "mountain_multi" : "mountain_day";
    case "nature":
      return multi ? "nature_multi" : "nature_day";
    case "desert":
      return multi ? "desert_multi" : "desert_day";
    case "cultural":
      // Legacy API type without denaliTourKind — prefer mountain slug over event misclassification.
      return multi ? "mountain_multi" : "mountain_day";
    default:
      return multi ? "nature_multi" : "nature_day";
  }
}

function datetimeFromLogistics(
  dateKey: "departureDate" | "returnDate",
  timeKey: "departureMeetingTime" | "returnMeetingTime",
  logistics: Record<string, unknown>,
): string | undefined {
  const date = strOrEmpty(logistics[dateKey]);
  if (!date) return undefined;
  const time = strOrEmpty(logistics[timeKey]) || "08:00";
  return combineYmdAndTimeToIso(date, time);
}

function readRequiresPayment(costContext: Record<string, unknown> | null | undefined): boolean {
  if (!costContext) return false;
  const flag =
    (costContext as { requiresPayment?: boolean }).requiresPayment ??
    (costContext as { requires_payment?: boolean }).requires_payment;
  return flag === true;
}

function priceFromCostContext(costContext: Record<string, unknown> | null | undefined): number {
  if (!costContext) return 0;
  const total = costContext.totalCost;
  return typeof total === "number" && Number.isFinite(total) ? total : 0;
}

function leaderUserIdsFromOverview(overview: Record<string, unknown>): string[] {
  const raw = overview.leaderUserIds;
  if (!Array.isArray(raw)) return [];
  return raw.filter((id): id is string => typeof id === "string" && id.trim().length > 0);
}

function localGuideNameFromOverview(overview: Record<string, unknown>): string | undefined {
  const name = strOrEmpty(overview.localGuideName);
  return name || undefined;
}

function resolveCloneLocationZones(
  overview: Record<string, unknown>,
  logistics: Record<string, unknown>,
): {
  gatheringPoint?: DenaliLocationData;
  startPoint?: DenaliLocationData;
  summitPoint?: DenaliLocationData;
  campPoint?: DenaliLocationData;
  endPoint?: DenaliLocationData;
  meetingPoint?: string;
  startPointLocationText?: string;
} {
  const gatheringPoint =
    denaliLocationFromApi(overview.gatheringPoint) ??
    denaliLocationFromText(strOrEmpty(logistics.meetingPoint) || undefined);
  const startPoint =
    denaliLocationFromApi(overview.startPoint) ??
    denaliLocationFromText(strOrEmpty(logistics.startPointVillage) || undefined);
  const summitPoint = denaliLocationFromApi(overview.summitPoint);
  const campPoint = denaliLocationFromApi(overview.campPoint);
  const endPoint =
    denaliLocationFromApi(overview.endPoint) ??
    denaliLocationFromText(strOrEmpty(logistics.returnPoint) || undefined);

  return {
    gatheringPoint,
    startPoint,
    summitPoint,
    campPoint,
    endPoint,
    meetingPoint: gatheringPoint?.addressText?.trim() || strOrEmpty(logistics.meetingPoint) || undefined,
    startPointLocationText:
      startPoint?.addressText?.trim() || strOrEmpty(logistics.startPointVillage) || undefined,
  };
}

/** Active workspace equipment ids for clone/create gear hydration. */
export function denaliActiveEquipmentIdsFromRows(
  rows: readonly { id: string; isActive: boolean }[] | undefined,
): readonly string[] {
  return (rows ?? [])
    .filter((row) => row.isActive)
    .map((row) => row.id.trim())
    .filter((id) => id.length > 0);
}

/**
 * Drops gear rows whose id is not in the workspace active equipment catalog.
 * When `activeEquipmentIds` is omitted, returns `gearItems` unchanged.
 */
export function filterGearItemsToActiveEquipmentCatalog(
  gearItems: DenaliGearItem[] | undefined,
  activeEquipmentIds: readonly string[] | undefined,
): DenaliGearItem[] | undefined {
  if (gearItems == null || gearItems.length === 0) {
    return gearItems;
  }
  if (activeEquipmentIds == null) {
    return gearItems;
  }
  const allowed = new Set(
    activeEquipmentIds.map((id) => id.trim()).filter((id) => id.length > 0),
  );
  const filtered = gearItems.filter((row) => allowed.has(row.id.trim()));
  return normalizeGearItems(filtered);
}

/**
 * Post-processes a mapped Denali form for **new-tour** wizard (`mode: "create"`).
 * Gear catalog filtering runs in {@link transformTourToDenaliWizardValues} for clone and create.
 */
export function applyDenaliCreateWizardHydrationGuards(
  form: Partial<DenaliCreateTourWizardForm>,
  denaliKind: DenaliTourKind,
  _options?: Pick<TransformTourToDenaliWizardOptions, "activeEquipmentIds">,
): Partial<DenaliCreateTourWizardForm> {
  const basics = denaliCanonicalBasicsFromTourKind(denaliKind);
  const isMountain =
    basics != null && isDenaliMountainCategory(basics.category);

  const tripDetails: Partial<DenaliCreateTourWizardForm["tripDetails"]> = {
    ...form.tripDetails,
    overview: {
      customServiceLabels: form.tripDetails?.overview?.customServiceLabels ?? [],
      ...form.tripDetails?.overview,
    },
  };
  if (
    isMountain &&
    (tripDetails.overview?.peakHeight == null ||
      !Number.isFinite(tripDetails.overview.peakHeight))
  ) {
    tripDetails.overview = {
      customServiceLabels: tripDetails.overview?.customServiceLabels ?? [],
      ...tripDetails.overview,
      peakHeight: CREATE_MOUNTAIN_ALTITUDE_FALLBACK_M,
    };
  }

  const participantRequirements: Partial<DenaliCreateTourWizardForm["participantRequirements"]> = {
    ...form.participantRequirements,
  };

  if (isMountain) {
    if (participantRequirements.fitnessLevel == null) {
      participantRequirements.fitnessLevel = "medium";
    }
    if (participantRequirements.minimumAge == null) {
      participantRequirements.minimumAge = 18;
    }
  }

  return {
    ...form,
    tripDetails: tripDetails as DenaliCreateTourWizardForm["tripDetails"],
    participantRequirements:
      participantRequirements as DenaliCreateTourWizardForm["participantRequirements"],
  };
}

/**
 * Maps canonical Tour API → Denali 6-tab wizard form (clone / edit bootstrap).
 */
export function transformTourToDenaliWizardValues(
  apiTour: TourCloneSourceDto,
  options?: TransformTourToDenaliWizardOptions,
): Partial<DenaliCreateTourWizardForm> {
  const mode = options?.mode ?? "clone";
  const tripDetails = asObject(apiTour.details?.tripDetails);
  const overview = asObject(tripDetails.overview);
  const itinerary = asObject(tripDetails.itinerary);
  const logistics = asObject(tripDetails.logistics);
  const participation = asObject(tripDetails.participation);
  const policies = asObject(tripDetails.policies);

  const themeIds = readThemeIds(overview.tourThemeIds);
  const itineraryRows = readDenaliItineraryDayPlans(itinerary);

  const apiTourType = strOrEmpty(apiTour.tourType) || "mountain";
  const denaliKind = inferDenaliTourKind(overview, apiTourType, logistics);
  const isMultiDay = denaliTourKindToIsMultiDay(denaliKind);

  const rootTransportModes = apiTour.transportModes ?? apiTour.transport_modes;
  const transportFields = inferDenaliTransportModeFromApiLogistics({
    primaryTransportMode: strOrEmpty(logistics.primaryTransportMode) || undefined,
    privateCarMode: strOrEmpty(logistics.privateCarMode) || undefined,
    fuelShareToman: numberOrUndefined(logistics.fuelShareToman),
    transportationNotes: strOrEmpty(logistics.transportationNotes) || undefined,
    rootTransportModes: stringArray(rootTransportModes),
  });

  const startDateTime = datetimeFromLogistics("departureDate", "departureMeetingTime", logistics);
  const endDateTime = isMultiDay
    ? datetimeFromLogistics("returnDate", "returnMeetingTime", logistics)
    : undefined;

  const difficultyLevel = ratingToDenaliDifficulty(overview.difficultyLevel);
  const peakHeight =
    numberOrUndefined(overview.maxAltitudeMeters) ??
    numberOrUndefined(overview.altitudeMeasurement);
  const elevationGain = numberOrUndefined(overview.elevationGainMeters);
  const preserveGalleryPhotoIds = options?.preserveGalleryPhotoIds === true;
  const tourPhotos = mapDayPlanPhotos(tripDetails.photos, {
    preserveIds: preserveGalleryPhotoIds,
  });
  const programNotes = itinerary.programNotes;
  const hikingHoursApprox = parseHikingHoursFromProgramNotes(programNotes) ?? undefined;
  const { hikingGoHours, hikingReturnHours } = parseHikingGoReturnFromProgramNotes(programNotes);
  const returnTimeRaw = strOrEmpty(logistics.returnMeetingTime);
  const approximateReturnTime =
    /^([01]\d|2[0-3]):[0-5]\d$/.test(returnTimeRaw) ? returnTimeRaw : undefined;

  const fitnessLegacy = strOrEmpty(participation.fitnessLevel);

  const basePrice = priceFromCostContext(apiTour.costContext);
  const requiresPayment = readRequiresPayment(apiTour.costContext) || basePrice > 0;
  const chatLink =
    strOrEmpty((apiTour as { chatLink?: string }).chatLink) ||
    strOrEmpty((apiTour as { chat_link?: string }).chat_link) ||
    undefined;

  const leaderUserIds = leaderUserIdsFromOverview(overview);
  const localGuideName = localGuideNameFromOverview(overview);
  const locations = resolveCloneLocationZones(overview, logistics);

  const rawGps = logistics.gatheringPoints;
  let gatheringPointsMapped = normalizeGatheringPickupStations(rawGps).map((station) => ({
    ...station,
    id: station.id ?? remintClonePhotoId(),
  }));
  if (gatheringPointsMapped.length === 0 && locations.gatheringPoint) {
    gatheringPointsMapped = [
      {
        ...gatheringPickupStationFromLegacyLocation(locations.gatheringPoint),
        id: remintClonePhotoId(),
      },
    ];
  }

  const gearItemsFromSource =
    gearCatalogIdsToGearItems(
      stringArray(participation.gearRequiredIds),
      stringArray(participation.gearOptionalIds),
    ) ?? [];
  const gearItems =
    options?.activeEquipmentIds !== undefined
      ? (filterGearItemsToActiveEquipmentCatalog(
          gearItemsFromSource,
          options.activeEquipmentIds,
        ) ?? [])
      : gearItemsFromSource;

  const mapped = normalizeDenaliWizardForm({
    basicInfo: {
      title: strOrEmpty(apiTour.title),
      leaderUserIds,
      ...(localGuideName != null
        ? { requiresLocalGuide: true as const, localGuideName }
        : {}),
      tourType: denaliKind,
      destinationId:
        strOrEmpty(apiTour.destinationId) || strOrEmpty(overview.settingsMainDestinationId),
      startDateTime: startDateTime ?? "",
      endDateTime,
      capacityMin: numberOrUndefined(logistics.groupSizeMin),
      capacityMax: numberOrUndefined(logistics.groupSizeMax) ?? 1,
      meetingPoint: locations.meetingPoint,
      startPointLocationText: locations.startPointLocationText,
      ...(locations.startPoint ? { startPoint: locations.startPoint } : {}),
      ...(locations.summitPoint ? { summitPoint: locations.summitPoint } : {}),
      ...(locations.campPoint ? { campPoint: locations.campPoint } : {}),
      ...(locations.endPoint ? { endPoint: locations.endPoint } : {}),
      approximateReturnTime,
      requiresManualAdminApproval: apiTour.autoAcceptRegistrations === false,
      publishStatus:
        apiTour.lifecycleStatus === "OPEN" || apiTour.lifecycleStatus === "open"
          ? "active"
          : "draft",
      socialMediaLink: chatLink,
    },
    programNature: {
      themeIds,
      shortDescription: strOrEmpty(overview.shortIntro),
      longDescription: strOrEmpty(apiTour.description) || undefined,
      difficultyLevel,
      hikingHoursApprox,
      hikingGoHours,
      hikingReturnHours,
      ...(isMultiDay && itineraryRows.length > 0 ? { itinerary: itineraryRows } : {}),
    },
    transport: transportFields,
    pricingPayment: {
      requiresPayment,
      basePricePerPerson: requiresPayment && basePrice > 0 ? basePrice : undefined,
      paymentMode: "offline_receipt",
      includesTourInsurance: logistics.leaderProvidesInsurance === true,
    },
    participantRequirements: {
      minimumAge: numberOrUndefined(participation.minimumAge),
      maximumAge: numberOrUndefined(participation.maximumAge),
      fitnessLevel: LEGACY_FITNESS_TO_DENALI[fitnessLegacy],
      nationalIdRequired: participation.registrationNationalIdRequired !== false,
      sportsInsuranceRequired: participation.sportsInsuranceRequired === true,
      minRequiredPeaks: readTourMinRequiredPeaks(tripDetails as Record<string, unknown>),
      fitnessPrerequisiteText:
        strOrEmpty(participation.fitnessPrerequisiteText) || undefined,
      gearItems,
    },
    policies: {
      policiesText: strOrEmpty(policies.cancellationPolicy) || undefined,
    },
    photosData: tourPhotos != null ? { photos: tourPhotos as DenaliCreateTourWizardForm["photosData"]["photos"] } : {},
    tripDetails: {
      logistics: {
        gatheringPoints: gatheringPointsMapped as any,
      },
      overview: {
        customServiceLabels: readOverviewCustomServiceLabels(overview),
        nonAttendanceDetails: readOverviewNonAttendanceDetails(overview),
        ...(peakHeight != null ? { peakHeight } : {}),
      },
      metrics: {
        ...(elevationGain != null ? { elevationGain } : {}),
      },
    },
  });

  if (mode === "create") {
    return applyDenaliCreateWizardHydrationGuards(mapped, denaliKind, {
      activeEquipmentIds: options?.activeEquipmentIds,
    });
  }

  return mapped;
}
