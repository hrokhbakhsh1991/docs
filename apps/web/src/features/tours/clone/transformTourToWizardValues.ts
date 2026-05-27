import type { TourCreateFormValues } from "@/features/tours/wizard/schemas/classic/tourCreateSchema";
import { UUID_V4_RE } from "@/features/tours/wizard/domain/mappers/wizardMapperHelpers";

/**
 * Read-side transform for the **Duplicate / Clone** path:
 * canonical Tour DTO (`apps/api/src/modules/tours/dto/tour-response.dto.ts` →
 * `details.tripDetails` per `TourTripDetailsDto`) → wizard `TourCreateFormValues`.
 *
 * Source of truth alignment notes:
 * - Theme order is the wizard contract `[main, ...secondaries]` written by
 *   `overviewTourThemeIdsFromWizard()` in `mapWizardFormToCreateTourPayload.ts`.
 * - `location.regionId` is the canonical `overview.settingsRegionId` (wizard
 *   writes via `mapWizardFormToCreateTourPayload.ts:95`).
 * - Itinerary days are read from the canonical `itinerary.segmentActivities`
 *   tree written by `mapItineraryDays()` in the same file.
 * - `pricing.basePrice` reverses the server-side `costContext.totalCost`
 *   shape (`apps/api/src/modules/tours/utils/commercial-fields.ts`).
 *
 * Anything that does *not* round-trip through `mapWizardFormToCreateTourPayload`
 * (e.g. `slug`, `displayLocation`, `safetyNotes`) is intentionally left as `""`
 * because the API never stores those keys; reading them was the source of
 * silent UI inconsistencies in the previous implementation.
 */

/** Loose typing for the BFF passthrough; the BFF route is a transparent proxy with no reshape. */
export type TourCloneSourceDto = {
  title?: string | null;
  description?: string | null;
  tourType?: string | null;
  chatLink?: string | null;
  communicationLink?: string | null;
  autoAcceptRegistrations?: boolean | null;
  transportModes?: unknown;
  transport_modes?: unknown;
  destinationId?: string | null;
  costContext?: Record<string, unknown> | null;
  formProfileSnapshot?: string | null;
  lifecycleStatus?: string | null;
  details?:
    | {
        tripDetails?: Record<string, unknown> | null;
      }
    | null;
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

/**
 * Canonical theme split: index 0 → main, rest → secondaries.
 *
 * Mirrors `overviewTourThemeIdsFromWizard()` in
 * `apps/web/src/features/tours/wizard/domain/mappers/wizardMapperHelpers.ts:100-110`
 * which writes `[main, ...secondaries]` and is the symmetrical write-side contract.
 */
function readMainAndSecondaryThemes(tourThemeIds: unknown): {
  main: string;
  secondary: string[];
} {
  const ids = stringArray(tourThemeIds);
  if (ids.length === 0) return { main: "", secondary: [] };
  const [first, ...rest] = ids;
  const deduped = [...new Set(rest.filter((id) => id !== first))];
  return { main: first ?? "", secondary: deduped };
}

/**
 * Canonical `secondaryDestinationIdsRaw` is a CSV / free-text string per
 * `TripDetailsOverviewDto.secondaryDestinationIdsRaw` (api trip-details.dto.ts:226-232).
 * Split, trim, and keep only UUID-v4 tokens so the wizard's Zod refine
 * (`tourCreateSchema.ts:374-381`) does not reject the rehydrated form.
 */
function parseSecondaryDestinationIdsRaw(raw: unknown): string[] {
  if (typeof raw !== "string" || raw.trim().length === 0) return [];
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && UUID_V4_RE.test(t));
}

/**
 * Canonical write stores `includedServices` / `excludedServices` as `string[]`
 * (`mapWizardFormToCreateTourPayload.ts:160-161` via `splitLinesToList`).
 * The wizard form, however, holds these as multi-line strings (Zod
 * `z.string().trim().optional()` in `tourCreateSchema.ts:186-187`).
 * Convert array → multi-line; if the server (legacy) already sends a string,
 * pass it through.
 */
function arrayToMultiline(value: unknown): string {
  if (Array.isArray(value)) {
    return value
      .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
      .join("\n");
  }
  return strOrEmpty(value);
}

/**
 * `pricing.basePrice` source is `costContext.totalCost` (major units),
 * see `apps/api/src/modules/tours/utils/commercial-fields.ts:25-32` which
 * persists the wizard's top-level `price` into `costContext.totalCost`.
 * The previous read of `costContext.basePriceToman` was a phantom key.
 */
function priceFromCostContext(costContext: Record<string, unknown> | null | undefined): number {
  if (!costContext) return 0;
  const total = costContext.totalCost;
  return typeof total === "number" && Number.isFinite(total) ? total : 0;
}

function readRequiresPaymentFromCostContext(
  costContext: Record<string, unknown> | null | undefined,
): boolean | undefined {
  if (!costContext) return undefined;
  const flag =
    (costContext as { requiresPayment?: boolean }).requiresPayment ??
    (costContext as { requires_payment?: boolean }).requires_payment;
  return flag === true ? true : undefined;
}

type WizardDay = TourCreateFormValues["itinerary"]["days"][number];
type WizardSegment = WizardDay["segments"][number];

function readItinerarySegment(rawSegment: unknown): WizardSegment {
  const seg = asObject(rawSegment);
  const activityType = typeof seg.activityType === "string" ? (seg.activityType as WizardSegment["activityType"]) : undefined;
  return {
    title: strOrEmpty(seg.title),
    description: strOrEmpty(seg.description),
    activityType,
    startTime: strOrEmpty(seg.startTime),
    endTime: strOrEmpty(seg.endTime),
    estimatedDurationHours: numberOrUndefined(seg.estimatedDurationHours),
    distanceKm: numberOrUndefined(seg.distanceKm),
    elevationGainMeters: numberOrUndefined(seg.elevationGainMeters),
    maxAltitudeMeters: numberOrUndefined(seg.maxAltitudeMeters),
    locationName: strOrEmpty(seg.locationName),
  } as WizardSegment;
}

function readItineraryDay(rawDay: unknown): WizardDay | null {
  const day = asObject(rawDay);
  const dayNumber = day.dayNumber;
  if (typeof dayNumber !== "number" || !Number.isInteger(dayNumber) || dayNumber < 1) return null;
  const segmentsRaw = Array.isArray(day.segments) ? day.segments : [];
  return {
    dayNumber,
    title: strOrEmpty(day.title),
    description: strOrEmpty(day.description),
    segments: segmentsRaw.map(readItinerarySegment),
  } as WizardDay;
}

/**
 * Canonical itinerary lives in `itinerary.segmentActivities`
 * (`TripDetailsItineraryDto.segmentActivities`, write side
 * `mapItineraryDays()` in `mapWizardFormToCreateTourPayload.ts:42-50`).
 *
 * Previous implementation read from `itinerary.days` which the API never
 * writes, so canonical clones produced an empty itinerary.
 *
 * TODO(clone-itinerary-product-decision): we now carry the full segment tree.
 * If product decides clones should start with an empty itinerary regardless
 * of the source, replace the body of this function with `return []` and
 * surface the source itinerary as a separate "import from source" affordance.
 */
function readItineraryDays(rawItinerary: Record<string, unknown>): WizardDay[] {
  const sa = rawItinerary.segmentActivities;
  if (!Array.isArray(sa)) return [];
  const days: WizardDay[] = [];
  for (const rawDay of sa) {
    const day = readItineraryDay(rawDay);
    if (day) days.push(day);
  }
  return days;
}

function inferSupplementalPrivateCar(rawTransportModes: unknown, primaryMode: string): boolean {
  if (primaryMode === "private_car") return false;
  if (primaryMode === "") return false;
  return stringArray(rawTransportModes).includes("private_car");
}

/**
 * Maps a canonical Tour API response → wizard form values for the
 * Duplicate / Clone flow. Returns a `Partial<TourCreateFormValues>` so the
 * wrapper can deep-merge with the wizard's default values on load.
 *
 * @deprecated Prefer {@link mapWizardPrefillToFormPatch} at app call sites.
 */
export function transformTourToWizardValues(
  apiTour: TourCloneSourceDto,
): Partial<TourCreateFormValues> {
  const tripDetails = asObject(apiTour.details?.tripDetails);
  const overview = asObject(tripDetails.overview);
  const itinerary = asObject(tripDetails.itinerary);
  const logistics = asObject(tripDetails.logistics);
  const participation = asObject(tripDetails.participation);
  const policies = asObject(tripDetails.policies);

  const { main: mainTourThemeId, secondary: secondaryTourThemeIds } =
    readMainAndSecondaryThemes(overview.tourThemeIds);

  const primaryModeStr = typeof logistics.primaryTransportMode === "string"
    ? logistics.primaryTransportMode.trim()
    : "";
  const rootTransportModes = apiTour.transportModes ?? apiTour.transport_modes;
  const supplementalPrivateCar = inferSupplementalPrivateCar(rootTransportModes, primaryModeStr);

  return {
    autoAcceptRegistrations: apiTour.autoAcceptRegistrations ?? true,

    overview: {
      title: strOrEmpty(apiTour.title),
      shortDescription: strOrEmpty(overview.shortIntro),
      longDescription: strOrEmpty(apiTour.description),
      slug: "",
      mainTourThemeId,
      secondaryTourThemeIds,
      tourType: strOrEmpty(apiTour.tourType),
      tripStyles: stringArray(overview.tripStyles),
      highlights: stringArray(itinerary.highlights),
      locationSummary: "",
      communicationLink: strOrEmpty(apiTour.communicationLink) || strOrEmpty(apiTour.chatLink),
    },

    pricing: {
      basePrice: priceFromCostContext(apiTour.costContext),
      currency: "TOMAN",
      discountNotes: "",
      requiresPayment: readRequiresPaymentFromCostContext(apiTour.costContext),
    },

    schedule: {
      startDate: "",
      endDate: "",
      departureMeetingTime: "",
      returnMeetingTime: "",
    },

    location: {
      regionId: strOrEmpty(overview.settingsRegionId),
      mainDestinationId:
        strOrEmpty(apiTour.destinationId) || strOrEmpty(overview.settingsMainDestinationId),
      secondaryDestinationIds: parseSecondaryDestinationIdsRaw(overview.secondaryDestinationIdsRaw),
      meetingPoint: strOrEmpty(logistics.meetingPoint),
      returnPoint: strOrEmpty(logistics.returnPoint),
      displayLocation: "",
    },

    itinerary: {
      days: readItineraryDays(itinerary),
    },

    participation: {
      requiredExperienceLevel: strOrEmpty(participation.experienceLevel),
      requiredFitnessLevel: strOrEmpty(participation.fitnessLevel),
      minimumAge: numberOrUndefined(participation.minimumAge),
      maximumAge: numberOrUndefined(participation.maximumAge),
      genderRestriction: strOrEmpty(participation.genderRestriction),
      technicalSkillRequired: strOrEmpty(participation.technicalSkillRequired),
      medicalRestrictions: strOrEmpty(participation.medicalRestrictions),
      requirements: strOrEmpty(participation.requirements),
      skillsRequired: stringArray(participation.skillsRequired),
      gearRequiredIds: stringArray(participation.gearRequiredIds),
      gearOptionalIds: stringArray(participation.gearOptionalIds),
      documentsRequired: stringArray(participation.documentsRequired),
      suitableFor: stringArray(participation.suitableFor),
      notSuitableFor: stringArray(participation.notSuitableFor),
      minParticipants: undefined,
      sportsInsuranceRequired: participation.sportsInsuranceRequired === true,
      registrationNationalIdRequired: participation.registrationNationalIdRequired === true,
    },

    logistics: {
      primaryTransportMode: primaryModeStr ? (primaryModeStr as never) : undefined,
      supplementalPrivateCar,
      fuelShareToman: numberOrUndefined(logistics.fuelShareToman),
      includedServices: arrayToMultiline(logistics.includedServices),
      excludedServices: arrayToMultiline(logistics.excludedServices),
      meetingPointDetails: "",
      transportationDetails: "",
      transportationNotes: strOrEmpty(logistics.transportationNotes),
      accommodationDetails: "",
      accommodationTypes: stringArray(logistics.accommodationTypes) as never,
      accommodationNotes: strOrEmpty(logistics.accommodationNotes),
      mealPlan: strOrEmpty(logistics.mealPlan),
      mealNotes: strOrEmpty(logistics.mealNotes),
      supportServices: stringArray(logistics.supportServices),
      optionalServices: stringArray(logistics.optionalServices),
      leaderProvidesInsurance: logistics.leaderProvidesInsurance === true,
      leaderInsuranceNotes: strOrEmpty(logistics.leaderInsuranceNotes),
      guideLanguageIds: stringArray(logistics.guideLanguageIds),
      groupSizeMin: numberOrUndefined(logistics.groupSizeMin),
      groupSizeMax: numberOrUndefined(logistics.groupSizeMax),
    },

    policies: {
      cancellationPolicy: strOrEmpty(policies.cancellationPolicy),
      refundPolicy: strOrEmpty(policies.refundPolicy),
      safetyNotes: "",
      riskDisclaimer: "",
      attendanceRules: strOrEmpty(policies.attendanceRules),
      lateArrivalPolicy: strOrEmpty(policies.lateArrivalPolicy),
      noShowPolicy: strOrEmpty(policies.noShowPolicy),
      confirmationPolicy: strOrEmpty(policies.confirmationPolicy),
      capacityPolicy: strOrEmpty(policies.capacityPolicy),
      safetyPolicy: strOrEmpty(policies.safetyPolicy),
      weatherPolicy: strOrEmpty(policies.weatherPolicy),
      reservationRules: strOrEmpty(policies.reservationRules),
    },
  };
}

// TODO(clone-meeting-times-carry): schedule.departureMeetingTime / returnMeetingTime are
// intentionally hard-coded `""` to mirror the previous wrapper behaviour; canonical writes
// land in `logistics.departureMeetingTime` / `returnMeetingTime`. Switching to carry these
// is a behaviour change pending product approval — see prompt.md alignment plan §2.6.

// TODO(clone-form-profile-snapshot): wrapper currently re-resolves the profile via
// `defaultTourFormProfileForTourType()` + workspace theme catalog. `apiTour.formProfileSnapshot`
// (canonical root field) is ignored on purpose. Promoting snapshot to the source of truth is a
// behaviour change pending product approval — see prompt.md §2.5.

// TODO(clone-theme-labels-snapshot): `overview.tourThemeLabels` is not carried into the
// wizard meta envelope. Once `_wizardMeta.themeLabels` is wired, badges for stale theme ids
// (themes deleted from the workspace catalog) can be rendered without an extra fetch.
