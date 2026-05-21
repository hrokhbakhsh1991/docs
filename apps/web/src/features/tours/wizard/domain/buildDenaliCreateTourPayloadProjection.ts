/**
 * Denali wizard → API payload projection (business rules live here, not in the mapper).
 */

import {
  denaliApiTourTypeFromCategory,
  denaliTourKindFromCanonical,
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
import { denaliFormToCanonical } from "@/features/tours/wizard/denali/denaliCanonicalFormAdapter";
import { readDenaliCanonicalBasics } from "@/features/tours/wizard/denali/denaliCanonicalBasicsControl";
import type { CreateTourDto } from "@/lib/services/tours.service";
import type { TourTripDetails } from "@/features/tours/models/tourTripDetails.schema";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliTourCreateSchema";

import {
  clampDurationToApiRange,
  deriveShortDescription,
  overviewTourThemeIdsFromWizard,
  trimToUndefined,
  YMD_RE,
} from "./mappers/wizardMapperHelpers";

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
    return { supplementalPrivateCar: false, transportModes: [] };
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
              ...(locationLabel ? { title: locationLabel } : {}),
              description,
              ...(locationDto ? { location: locationDto } : {}),
              photos: (row.photos ?? [])
                .filter((p) => p.id && p.url)
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
      ...(locationToTripDetailsDto(canonical.gatheringPoint)
        ? { gatheringPoint: locationToTripDetailsDto(canonical.gatheringPoint) }
        : {}),
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
      isPositiveInt(canonical.program.altitudeMeasurement)
        ? { maxAltitudeMeters: canonical.program.altitudeMeasurement }
        : {}),
    },
    itinerary: {
      outline: undefined,
      ...(programNotes != null ? { programNotes } : {}),
      ...(itineraryDayPlans.length > 0 ? { dayPlans: itineraryDayPlans } : {}),
    },
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
      primaryTransportMode: transport.primaryTransportMode,
      departureDate: startParts.date,
      returnDate: endParts.date,
      departureMeetingTime: startParts.time,
      returnMeetingTime,
      meetingPoint:
        denaliLocationAddressText(canonical.gatheringPoint) ??
        trimToUndefined(canonical.meetingPoint),
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
    ...(canonical.photos && canonical.photos.length > 0
      ? {
          photos: canonical.photos
            .filter((p) => p.id && p.url)
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

/** Resolves Denali wizard form → fully expanded create-tour projection (submit pipeline). */
export function buildDenaliCreateTourPayloadProjection(
  form: DenaliCreateTourWizardForm,
): DenaliCreateTourPayloadProjection {
  const canonical = denaliFormToCanonical(form);
  const basics = readDenaliCanonicalBasics(
    form.basicInfo.tourType as DenaliTourKind | undefined,
  );

  return buildProjectionFromCanonical(canonical, {
    eventVariant: basics?.eventVariant,
  });
}
