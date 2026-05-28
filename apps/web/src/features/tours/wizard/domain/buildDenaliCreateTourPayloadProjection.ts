/**
 * Denali wizard → API payload projection (business rules live here, not in the mapper).
 */

import {
  denaliApiTourTypeFromCategory,
  denaliTourKindFromCanonical,
  gatheringPickupStationToPersisted,
  isDenaliMountainCategory,
  type DenaliEventVariant,
  type DenaliTourCategory,
  type DenaliTourDuration,
  type DenaliTourKind,
} from "@repo/types";
import {
  denaliLocationAddressText,
  isDenaliOrganizedTransportWithPersonalCarOption,
  isDenaliTransportDongAmountVisible,
  type DenaliCanonicalDuration,
  type DenaliCanonicalTourModel,
  type DenaliLocationData,
} from "@repo/types/denali";

import { buildDenaliCancellationPolicyText } from "@/features/tours/wizard/denali/denaliCancellationPolicy";
import { isClientBlobUrl } from "@/features/tours/wizard/denali/preserveDenaliWizardBlobMedia";
import { denaliFormToCanonical } from "@/features/tours/wizard/denali/denaliCanonicalFormAdapter";
import { readDenaliCanonicalBasics } from "@/features/tours/wizard/denali/denaliCanonicalBasicsControl";
import type { CreateTourDto } from "@/lib/services/tours.service";
import type { TourTripDetails } from "@/features/tours/models/tourTripDetails.schema";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliCore.schema";

import {
  clampDurationToApiRange,
  deriveShortDescription,
  overviewTourThemeIdsFromWizard,
  trimToUndefined,
  YMD_RE,
} from "./mappers/wizardMapperHelpers";
import { normalizeCustomServiceLabels } from "./normalizeCustomServiceLabels";

type ApiTourType = NonNullable<CreateTourDto["tourType"]>;

function isPositiveInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

/** Primary coordination URL for `chat_link` (Telegram, Bale, Eitaa, Instagram, etc.). */
function resolveDenaliCommunicationLink(
  canonical: DenaliCanonicalTourModel,
): string | undefined {
  return trimToUndefined(canonical.socialMediaLink);
}

function locationToTripDetailsDto(
  loc: DenaliLocationData | undefined,
): { addressText: string; latitude: number | null; longitude: number | null } | undefined {
  if (!loc) return undefined;
  const addressText = loc.addressText?.trim() ?? "";
  if (!addressText && loc.latitude == null && loc.longitude == null) {
    return undefined;
  }
  return {
    addressText,
    latitude: loc.latitude ?? null,
    longitude: loc.longitude ?? null,
  };
}

/** Wizard RHF enum → API `participation.fitnessLevel` slug. */
function denaliWizardFitnessToApi(
  level: DenaliCreateTourWizardForm["participantRequirements"]["fitnessLevel"],
): string | undefined {
  switch (level) {
    case "low":
      return "easy";
    case "medium":
      return "moderate";
    case "high":
      return "hard";
    default:
      return undefined;
  }
}

/** Fully resolved create-tour payload before 1:1 {@link mapDenaliWizardToCreateTourPayload} copy. */
export type DenaliCreateTourPayloadProjection = CreateTourDto;

function canonicalDurationToFormDuration(duration: DenaliCanonicalDuration): DenaliTourDuration {
  return duration === "multi" ? "multi_day" : "single_day";
}

export function splitIsoDateTime(iso: string | undefined): { date?: string; time?: string } {
  if (!iso?.trim()) return {};
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return {};
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return { date: `${y}-${m}-${day}`, time: `${hh}:${mm}` };
}

/** Slug → API `tourType` (tests and clone helpers). */
export function denaliTourKindToApiTourType(kind: DenaliTourKind): ApiTourType {
  if (kind.startsWith("mountain")) return "mountain";
  if (kind.startsWith("nature")) return "nature";
  if (kind.startsWith("desert")) return "desert";
  return "cultural";
}

function computeDurationFromIso(startIso: string, endIso?: string): number | undefined {
  const start = splitIsoDateTime(startIso).date;
  const end = splitIsoDateTime(endIso).date;
  if (!start || !end || !YMD_RE.test(start) || !YMD_RE.test(end)) return undefined;
  const startMs = Date.parse(`${start}T00:00:00Z`);
  const endMs = Date.parse(`${end}T00:00:00Z`);
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs < startMs) return undefined;
  return clampDurationToApiRange(Math.round((endMs - startMs) / 86_400_000) + 1);
}

type DenaliFormProgramOutdoor = {
  difficultyLevel?: number | "easy" | "medium" | "hard";
  hikingHoursApprox?: number;
};

function denaliFormDifficultyToRating(
  level: NonNullable<DenaliFormProgramOutdoor["difficultyLevel"]>,
): number {
  if (typeof level === "number") return level;
  if (level === "easy") return 3;
  if (level === "medium") return 5.5;
  return 8;
}

function hikingHoursToProgramNotes(hours: number): string {
  return `مدت تقریبی پیاده‌روی: ${hours} ساعت`;
}

function buildDenaliProgramNotes(program: DenaliCanonicalTourModel["program"]): string | undefined {
  const parts: string[] = [];
  if (
    program.hikingHoursApprox != null &&
    program.hikingHoursApprox > 0
  ) {
    parts.push(hikingHoursToProgramNotes(program.hikingHoursApprox));
  }
  if (program.hikingGoHours != null && program.hikingGoHours > 0) {
    parts.push(`رفت: ${program.hikingGoHours} ساعت`);
  }
  if (program.hikingReturnHours != null && program.hikingReturnHours > 0) {
    parts.push(`برگشت: ${program.hikingReturnHours} ساعت`);
  }
  return parts.length > 0 ? parts.join("\n") : undefined;
}

type DenaliTransportJsonSlice = {
  transportCost?: number;
  allowPersonalCar?: boolean;
  dongAmount?: number;
};

function buildDenaliTransportJson(
  transport: DenaliCanonicalTourModel["transport"],
): DenaliTransportJsonSlice | undefined {
  const slice: DenaliTransportJsonSlice = {};
  if (isPositiveInt(transport.transportCost)) {
    slice.transportCost = transport.transportCost;
  }
  if (transport.allowPersonalCar === true) {
    slice.allowPersonalCar = true;
  }
  const dongVisible = isDenaliTransportDongAmountVisible({
    mode: transport.mode,
    allowPersonalCar: transport.allowPersonalCar,
  });
  if (dongVisible && isPositiveInt(transport.dongAmount)) {
    slice.dongAmount = transport.dongAmount;
  }
  return Object.keys(slice).length > 0 ? slice : undefined;
}

type DenaliItineraryDayPlanProjection = {
  day: number;
  description: string;
  title?: string;
};

type DenaliSegmentActivitiesPayload = NonNullable<
  NonNullable<TourTripDetails["itinerary"]>["segmentActivities"]
>;

/**
 * Maps Denali multi-day `dayPlans` → API `segmentActivities` (classic wizard parity).
 * Each day gets ≥1 segment with non-empty `title` and `description`.
 */
export function denaliDayPlansToSegmentActivities(
  dayPlans: readonly DenaliItineraryDayPlanProjection[],
): DenaliSegmentActivitiesPayload {
  return dayPlans.map((plan) => {
    const description = plan.description.trim();
    const segmentTitle = plan.title?.trim() || `روز ${plan.day}`;
    const segmentDescription = description.length > 0 ? description : segmentTitle;
    return {
      dayNumber: plan.day,
      title: segmentTitle,
      description: segmentDescription,
      segments: [
        {
          title: segmentTitle,
          description: segmentDescription,
          activityType: undefined,
          startTime: undefined,
          endTime: undefined,
          estimatedDurationHours: undefined,
          distanceKm: undefined,
          elevationGainMeters: undefined,
          maxAltitudeMeters: undefined,
          locationName: undefined,
        },
      ],
    };
  });
}

/** Minimal itinerary for classic `itinerary.days` submit-required (single-day Denali has no dayPlans UI). */
export function buildDenaliSubmitItinerarySlice(input: {
  dayPlans: Array<DenaliItineraryDayPlanProjection>;
  programNotes?: string;
  fallbackSegmentTitle: string;
}): NonNullable<TourTripDetails["itinerary"]> {
  const base: NonNullable<TourTripDetails["itinerary"]> = {
    outline: undefined,
    programNotes: undefined,
  };
  if (input.programNotes != null) {
    base.programNotes = input.programNotes;
  }
  if (input.dayPlans.length > 0) {
    base.dayPlans = input.dayPlans as any;
    base.segmentActivities = denaliDayPlansToSegmentActivities(input.dayPlans);
    return base;
  }
  const segmentTitle = input.fallbackSegmentTitle.trim() || "برنامه روز";
  base.segmentActivities = [
    {
      dayNumber: 1,
      title: segmentTitle,
      description: segmentTitle,
      segments: [
        {
          title: segmentTitle,
          description: segmentTitle,
          activityType: undefined,
          startTime: undefined,
          endTime: undefined,
          estimatedDurationHours: undefined,
          distanceKm: undefined,
          elevationGainMeters: undefined,
          maxAltitudeMeters: undefined,
          locationName: undefined,
        },
      ],
    },
  ];
  return base;
}

function denaliModeToApiPrimary(mode: DenaliCanonicalTourModel["transport"]["mode"]): string {
  if (mode === "minibus") return "midibus";
  if (mode === "train") return "train";
  if (mode === "organizer_vehicle") return "bus";
  return "bus";
}

function mapCanonicalTransport(transport: DenaliCanonicalTourModel["transport"]): {
  primaryTransportMode?: string;
  transportModes?: CreateTourDto["transportModes"];
  supplementalPrivateCar: boolean;
  fuelShareToman?: number;
  transportationNotes?: string;
  privateCarMode?: string;
  denaliTransport?: DenaliTransportJsonSlice;
} {
  if (transport.mode === "none") {
    return {
      supplementalPrivateCar: false,
      transportModes: [],
    };
  }

  if (transport.mode === "shared_cars") {
    return {
      primaryTransportMode: "bus",
      transportModes: ["bus", "private_car"] as CreateTourDto["transportModes"],
      supplementalPrivateCar: true,
      ...(isPositiveInt(transport.dongAmount) ? { fuelShareToman: transport.dongAmount } : {}),
      privateCarMode: "car_share_fixed_dong",
      denaliTransport: buildDenaliTransportJson({
        ...transport,
        allowPersonalCar: true,
      }),
    };
  }

  if (isDenaliOrganizedTransportWithPersonalCarOption(transport.mode)) {
    const allowPersonal = transport.allowPersonalCar === true;
    const apiPrimary = denaliModeToApiPrimary(transport.mode);
    const modes: CreateTourDto["transportModes"] = allowPersonal
      ? ([apiPrimary, "private_car"] as CreateTourDto["transportModes"])
      : ([apiPrimary] as CreateTourDto["transportModes"]);
    const dongVisible = isDenaliTransportDongAmountVisible({
      mode: transport.mode,
      allowPersonalCar: transport.allowPersonalCar,
    });
    return {
      primaryTransportMode: apiPrimary,
      transportModes: modes,
      supplementalPrivateCar: allowPersonal,
      ...(dongVisible && isPositiveInt(transport.dongAmount)
        ? { fuelShareToman: transport.dongAmount }
        : {}),
      ...(allowPersonal ? { privateCarMode: "car_share_fixed_dong" as const } : {}),
      denaliTransport: buildDenaliTransportJson(transport),
    };
  }

  if (transport.mode === "organizer_vehicle") {
    return {
      primaryTransportMode: "bus",
      transportModes: ["bus"] as CreateTourDto["transportModes"],
      supplementalPrivateCar: false,
      denaliTransport: buildDenaliTransportJson(transport),
    };
  }

  return {
    primaryTransportMode: "bus",
    transportModes: ["bus"] as CreateTourDto["transportModes"],
    supplementalPrivateCar: false,
  };
}

export type BuildDenaliCreateTourPayloadProjectionOptions = {
  eventVariant?: DenaliEventVariant;
};

function buildProjectionFromCanonical(
  canonical: DenaliCanonicalTourModel,
  options?: BuildDenaliCreateTourPayloadProjectionOptions,
): DenaliCreateTourPayloadProjection {
  const formDuration = canonicalDurationToFormDuration(canonical.duration);
  const category = canonical.category as DenaliTourCategory;
  const denaliTourKind = denaliTourKindFromCanonical({
    category,
    duration: formDuration,
    eventVariant: options?.eventVariant,
  });
  const apiTourType = denaliApiTourTypeFromCategory(category);

  const startParts = splitIsoDateTime(canonical.startDateTime);
  const endParts = splitIsoDateTime(canonical.endDateTime);

  const shortIntro =
    deriveShortDescription(canonical.program.shortDescription, canonical.program.longDescription) ??
    "";

  const transport = mapCanonicalTransport(canonical.transport);
  const denaliTransportSlice =
    buildDenaliTransportJson(canonical.transport) ??
    transport.denaliTransport;
  const isEvent = category === "event";
  const difficultyRating =
    !isEvent && canonical.program.difficultyLevel != null
      ? denaliFormDifficultyToRating(canonical.program.difficultyLevel)
      : undefined;
  const programNotes = !isEvent ? buildDenaliProgramNotes(canonical.program) : undefined;
  const transportationNotes = trimToUndefined(canonical.transport.transportNotes);

  const itineraryDayPlans =
    canonical.duration === "multi" && canonical.program.itinerary != null
      ? canonical.program.itinerary
          .map((row) => {
            const activities = row.activities.trim();
            const locationLabel =
              row.locationText?.trim() ||
              row.location?.addressText?.trim() ||
              undefined;
            const locationDto = locationToTripDetailsDto(row.location);
            const description =
              locationLabel && activities
                ? `${locationLabel}\n${activities}`
                : locationLabel || activities;
            return {
              day: row.day,
              title: locationLabel,
              description,
              location: locationDto,
              distanceKm: undefined,
              elevationGainM: undefined,
              photos: (row.photos ?? [])
                .filter((p) => p.id && p.url && !isClientBlobUrl(p.url))
                .map((p) => ({
                  id: p.id,
                  url: p.url,
                  filename: p.filename,
                  size: p.size,
                  mimeType: p.mimeType,
                  uploadedAt: p.uploadedAt,
                })),
            };
          })
          .filter((row) => row.description !== "")
      : [];

  const returnMeetingTime =
    trimToUndefined(canonical.approximateReturnTime) ?? endParts.time;

  const gearRequiredIds: string[] = [];
  const gearOptionalIds: string[] = [];
  for (const item of canonical.participants.gearItems ?? []) {
    if (!item.id?.trim()) continue;
    if (item.isRequired) gearRequiredIds.push(item.id);
    else gearOptionalIds.push(item.id);
  }

  const tripDetails = {
    overview: {
      denaliTourKind,
      settingsMainDestinationId: canonical.destinationId,
      tourThemeIds:
        canonical.program.themeIds.length > 0
          ? overviewTourThemeIdsFromWizard(undefined, canonical.program.themeIds)
          : undefined,
      shortIntro,
      leaderUserIds: canonical.leaderUserIds ?? [],
      localGuideName: trimToUndefined(canonical.localGuideName),
      ...(locationToTripDetailsDto(canonical.startPoint)
        ? { startPoint: locationToTripDetailsDto(canonical.startPoint) }
        : {}),
      ...(locationToTripDetailsDto(canonical.summitPoint)
        ? { summitPoint: locationToTripDetailsDto(canonical.summitPoint) }
        : {}),
      ...(locationToTripDetailsDto(canonical.campPoint)
        ? { campPoint: locationToTripDetailsDto(canonical.campPoint) }
        : {}),
      ...(locationToTripDetailsDto(canonical.endPoint)
        ? { endPoint: locationToTripDetailsDto(canonical.endPoint) }
        : {}),
      ...(difficultyRating != null ? { difficultyLevel: difficultyRating } : {}),
      ...(isDenaliMountainCategory(category) &&
      isPositiveInt(canonical.overview?.peakHeight)
        ? { maxAltitudeMeters: canonical.overview.peakHeight }
        : {}),
      ...(isPositiveInt(canonical.metrics?.elevationGain)
        ? { elevationGainMeters: canonical.metrics.elevationGain }
        : {}),
    },
    itinerary: buildDenaliSubmitItinerarySlice({
      dayPlans: itineraryDayPlans as any,
      programNotes,
      fallbackSegmentTitle: canonical.title,
    }),
    participation: {
      minimumAge: canonical.participants.minimumAge,
      maximumAge: canonical.participants.maximumAge,
      ...(isDenaliMountainCategory(category) &&
      canonical.participants.fitnessLevel != null
        ? {
            fitnessLevel: denaliWizardFitnessToApi(canonical.participants.fitnessLevel),
          }
        : {}),
      ...(canonical.participants.nationalIdRequired === true
        ? { registrationNationalIdRequired: true }
        : {}),
      ...(isDenaliMountainCategory(category) &&
      canonical.participants.sportsInsuranceRequired === true
        ? { sportsInsuranceRequired: true }
        : {}),
      ...(trimToUndefined(canonical.participants.fitnessPrerequisiteText) != null
        ? {
            fitnessPrerequisiteText: trimToUndefined(
              canonical.participants.fitnessPrerequisiteText,
            ),
          }
        : {}),
      ...(gearRequiredIds.length > 0 ? { gearRequiredIds } : {}),
      ...(gearOptionalIds.length > 0 ? { gearOptionalIds } : {}),
    },
    logistics: {
      ...(transport.primaryTransportMode != null
        ? { primaryTransportMode: transport.primaryTransportMode }
        : {}),
      departureDate: startParts.date,
      returnDate: endParts.date,
      departureMeetingTime: startParts.time,
      returnMeetingTime,
      meetingPoint: (() => {
        const primary = canonical.gatheringPoints?.[0];
        return (
          primary?.title.trim() ||
          denaliLocationAddressText(primary?.location) ||
          denaliLocationAddressText(canonical.gatheringPoint) ||
          trimToUndefined(canonical.meetingPoint)
        );
      })(),
      ...(canonical.gatheringPoints != null && canonical.gatheringPoints.length > 0
        ? {
            gatheringPoints: canonical.gatheringPoints.map((station) =>
              gatheringPickupStationToPersisted(station),
            ),
          }
        : {}),
      ...(() => {
        const startVillage =
          denaliLocationAddressText(canonical.startPoint) ??
          trimToUndefined(canonical.startPointLocationText);
        return startVillage != null ? { startPointVillage: startVillage } : {};
      })(),
      ...(() => {
        const returnPoint = denaliLocationAddressText(canonical.endPoint);
        return returnPoint != null ? { returnPoint } : {};
      })(),
      ...(canonical.pricing.includesTourInsurance === true
        ? { leaderProvidesInsurance: true }
        : {}),
      groupSizeMin: canonical.capacityMin,
      groupSizeMax: canonical.capacityMax,
      fuelShareToman: transport.fuelShareToman,
      ...(transport.privateCarMode ? { privateCarMode: transport.privateCarMode } : {}),
      ...(transportationNotes != null ? { transportationNotes } : {}),
    },
    policies: {
      cancellationPolicy: buildDenaliCancellationPolicyText(canonical.policies),
    },
    ...(typeof canonical.participants.minRequiredPeaks === "number" &&
    Number.isInteger(canonical.participants.minRequiredPeaks) &&
    canonical.participants.minRequiredPeaks >= 1 &&
    canonical.participants.minRequiredPeaks <= 4
      ? { requirements: { minRequiredPeaks: canonical.participants.minRequiredPeaks } }
      : {}),
    ...(canonical.photos && canonical.photos.length > 0
      ? {
          photos: canonical.photos
            .filter((p) => p.id && p.url && !isClientBlobUrl(p.url))
            .map((p) => ({
              id: p.id,
              url: p.url,
              filename: p.filename,
              size: p.size,
              mimeType: p.mimeType,
              uploadedAt: p.uploadedAt,
            })),
        }
      : {}),
    ...(denaliTransportSlice != null ? { transport: denaliTransportSlice } : {}),
  } as unknown as TourTripDetails;

  const durationDays = computeDurationFromIso(canonical.startDateTime, canonical.endDateTime);

  if (!isPositiveInt(canonical.capacityMax)) {
    throw new Error(
      "buildDenaliCreateTourPayloadProjection: capacityMax must be a positive integer (submit gate should have blocked).",
    );
  }

  const isPaid = canonical.pricing.requiresPayment === true;
  const price =
    isPaid && isPositiveInt(canonical.pricing.basePricePerPerson)
      ? canonical.pricing.basePricePerPerson
      : 0;
  const communicationLink = resolveDenaliCommunicationLink(canonical);

  return {
    title: canonical.title.trim(),
    description: trimToUndefined(canonical.program.longDescription) ?? shortIntro,
    tourType: apiTourType,
    ...(durationDays != null ? { durationDays } : {}),
    destinationId: canonical.destinationId,
    capacity: canonical.capacityMax,
    price,
    ...(isPaid ? { requiresPayment: true, paymentMode: "offline_receipt" as const } : {}),
    ...(communicationLink != null ? { communicationLink } : {}),
    autoAcceptRegistrations: canonical.requiresManualAdminApproval !== true,
    meetingPoint: trimToUndefined(canonical.meetingPoint),
    ...(transport.transportModes && transport.transportModes.length > 0
      ? { transportModes: transport.transportModes }
      : transport.transportModes?.length === 0
        ? { transportModes: [] }
        : {}),
    tripDetails,
    lifecycle_status: "Draft",
  };
}

function denaliWizardLifecycleStatus(
  publishStatus: DenaliCreateTourWizardForm["basicInfo"]["publishStatus"],
): "Draft" | "Open" {
  return publishStatus === "active" ? "Open" : "Draft";
}

/** Resolves Denali wizard form → fully expanded create-tour projection (submit pipeline). */
export function buildDenaliCreateTourPayloadProjection(
  form: DenaliCreateTourWizardForm,
): DenaliCreateTourPayloadProjection {
  const canonical = denaliFormToCanonical(form);
  const basics = readDenaliCanonicalBasics(
    form.basicInfo.tourType as DenaliTourKind | undefined,
  );

  const projection = buildProjectionFromCanonical(canonical, {
    eventVariant: basics?.eventVariant,
  });
  // Registry wire: createTourDto.customServiceLabels + tripDetails.overview.* (manual overview merge)
  const customServiceLabels = normalizeCustomServiceLabels(
    form.tripDetails?.overview?.customServiceLabels,
  );
  const nonAttendanceDetails = trimToUndefined(
    form.tripDetails?.overview?.nonAttendanceDetails ??
      canonical.overview?.nonAttendanceDetails,
  );
  const isMountain =
    basics != null && isDenaliMountainCategory(basics.category);
  const peakHeight = isMountain
    ? (canonical.overview?.peakHeight ?? form.tripDetails?.overview?.peakHeight)
    : undefined;
  const elevationGain =
    canonical.metrics?.elevationGain ?? form.tripDetails?.metrics?.elevationGain;
  const tripDetailsWithOverview = mergeDenaliWizardOverviewIntoTripDetails(
    projection.tripDetails,
    {
      customServiceLabels,
      nonAttendanceDetails,
      peakHeight,
      elevationGain,
    },
  );

  return {
    ...projection,
    tripDetails: tripDetailsWithOverview,
    ...(customServiceLabels ? { customServiceLabels } : {}),
    lifecycle_status: denaliWizardLifecycleStatus(form.basicInfo.publishStatus),
  };
}

function mergeDenaliWizardOverviewIntoTripDetails(
  tripDetails: TourTripDetails | undefined,
  overviewPatch: {
    customServiceLabels?: string[];
    nonAttendanceDetails?: string;
    peakHeight?: number;
    elevationGain?: number;
  },
): TourTripDetails | undefined {
  if (!tripDetails) {
    return tripDetails;
  }
  const hasCustomServiceLabels =
    overviewPatch.customServiceLabels != null && overviewPatch.customServiceLabels.length > 0;
  const hasNonAttendanceDetails = overviewPatch.nonAttendanceDetails != null;
  const hasPeakHeight = isPositiveInt(overviewPatch.peakHeight);
  const hasElevationGain = isPositiveInt(overviewPatch.elevationGain);
  if (
    !hasCustomServiceLabels &&
    !hasNonAttendanceDetails &&
    !hasPeakHeight &&
    !hasElevationGain
  ) {
    return tripDetails;
  }

  const existingOverview =
    (tripDetails as { overview?: Record<string, unknown> }).overview ?? {};

  return {
    ...tripDetails,
    overview: {
      ...existingOverview,
      ...(hasCustomServiceLabels
        ? { customServiceLabels: overviewPatch.customServiceLabels }
        : {}),
      ...(hasNonAttendanceDetails
        ? { nonAttendanceDetails: overviewPatch.nonAttendanceDetails }
        : {}),
      ...(hasPeakHeight ? { maxAltitudeMeters: overviewPatch.peakHeight } : {}),
      ...(hasElevationGain ? { elevationGainMeters: overviewPatch.elevationGain } : {}),
    },
  } as unknown as TourTripDetails;
}
