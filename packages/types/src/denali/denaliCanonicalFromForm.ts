/**
 * Phase 4 migration step 1: canonical model introduced, not wired yet.
 *
 * Pure adapter: legacy wizard form → {@link DenaliCanonicalTourModel}.
 * Does not import `apps/web`; structural input type mirrors `DenaliCreateTourWizardForm`.
 */

import { denaliCanonicalBasicsFromTourKind } from "../denali-canonical-tour-model";
import type { DenaliTourKind } from "../denali-tour-kind";
import type { DenaliTransportMode } from "../denali-transport-mode";

import {
  denaliFormAmountToCanonical,
  denaliFormCapacityMaxToCanonical,
} from "./denaliNumericFields";
import {
  denaliLocationAddressText,
  denaliLocationFromText,
  type DenaliLocationData,
} from "./locationData";
import {
  gatheringPickupStationFromLegacyLocation,
  normalizeGatheringPickupStations,
  type DenaliGatheringPickupStation,
} from "./gatheringPickupStation";
import type {
  DenaliCanonicalDuration,
  DenaliCanonicalTourModel,
  DenaliCanonicalTransportMode,
} from "./denaliCanonicalTourModel";

/** Minimal legacy form slice required for canonical mapping (matches wizard schema). */
export type DenaliWizardFormLike = {
  basicInfo: {
    title?: string;
    tourType?: DenaliTourKind;
    destinationId?: string;
    startDateTime?: string;
    endDateTime?: string;
    capacityMin?: number;
    capacityMax?: number;
    meetingPoint?: string;
    startPointLocationText?: string;
    gatheringPoint?: DenaliLocationData;
    startPoint?: DenaliLocationData;
    summitPoint?: DenaliLocationData;
    campPoint?: DenaliLocationData;
    endPoint?: DenaliLocationData;
    /** @deprecated Use `startPointLocationText`. */
    startPointVillage?: string;
    approximateReturnTime?: string;
    leaderUserIds?: string[];
    requiresLocalGuide?: boolean;
    localGuideName?: string;
    requiresManualAdminApproval?: boolean;
    publishStatus?: string;
    socialMediaLink?: string;
    /** @deprecated Use socialMediaLink. */
    telegramUrl?: string;
    /** @deprecated Use socialMediaLink. */
    baleUrl?: string;
    /** @deprecated Use socialMediaLink. */
    eitaaUrl?: string;
  };
  programNature: {
    themeIds?: string[];
    /** @deprecated Merged into themeIds on read. */
    mainTourThemeId?: string;
    shortDescription?: string;
    longDescription?: string;
    difficultyLevel?: number | string;
    hikingHoursApprox?: number;
    hikingGoHours?: number;
    hikingReturnHours?: number;
    /** @deprecated Use `hikingGoHours`. */
    hikingUpHours?: number;
    /** @deprecated Use `hikingReturnHours`. */
    hikingDownHours?: number;
    altitudeMeasurement?: number;
    itinerary?: Array<{
      day: number;
      activities: string;
      locationText?: string;
      location?: DenaliLocationData;
      photos?: Array<{
        id: string;
        url: string;
        filename?: string;
        size?: number;
        mimeType?: string;
        uploadedAt?: string;
      }>;
    }>;
    altitudeGainApprox?: number;
    itineraryOutline?: string;
    /** @deprecated Merged into themeIds on read. */
    secondaryTourThemeIds?: string[];
  };
  transport: {
    transportMode?: DenaliTransportMode;
    transportCost?: number;
    allowPersonalCar?: boolean;
    dongAmount?: number;
    transportNotes?: string;
    adminCapacityApproval?: boolean;
  };
  pricingPayment: {
    requiresPayment?: boolean;
    basePricePerPerson?: number;
    paymentMode?: string;
    includesTourInsurance?: boolean;
    /** @deprecated Smart-pricing fields — ignored on read. */
    basePriceWithPersonalCar?: number;
    hasGroupTransportOption?: boolean;
    priceWithGroupTransport?: number;
  };
  participantRequirements: {
    minimumAge?: number;
    maximumAge?: number;
    fitnessLevel?: string;
    experienceLevel?: string;
    nationalIdRequired?: boolean;
    sportsInsuranceRequired?: boolean;
    minRequiredPeaks?: number;
    fitnessPrerequisiteText?: string;
    medicalNotes?: string;
    technicalSkillNotes?: string;
    gearItems?: Array<{ id: string; isRequired: boolean }>;
    requiredGearIds?: string[];
    optionalGearIds?: string[];
  };
  policies: {
    policiesText?: string;
    cancellationDeadlineHours?: number;
    cancellationPenaltyPercentage?: number;
    /** @deprecated Read via policiesText merge. */
    cancellationPolicy?: string;
    refundPolicy?: string;
    attendanceRules?: string;
    safetyPolicy?: string;
    weatherPolicy?: string;
  };
  tripDetails?: {
    logistics?: {
      gatheringPoints?: unknown[];
    };
  };
};

function resolveGatheringPointsFromForm(form: DenaliWizardFormLike): DenaliGatheringPickupStation[] {
  const fromLogistics = normalizeGatheringPickupStations(form.tripDetails?.logistics?.gatheringPoints);
  if (fromLogistics.length > 0) {
    return fromLogistics;
  }
  const legacyPin =
    form.basicInfo.gatheringPoint ?? denaliLocationFromText(trimOptionalString(form.basicInfo.meetingPoint));
  if (legacyPin) {
    return [gatheringPickupStationFromLegacyLocation(legacyPin)];
  }
  return [];
}

function formDurationToCanonical(duration: "single_day" | "multi_day"): DenaliCanonicalDuration {
  return duration === "multi_day" ? "multi" : "single";
}

function transportModeToCanonical(mode: DenaliTransportMode | undefined): DenaliCanonicalTransportMode {
  if (
    mode === "organizer_vehicle" ||
    mode === "bus" ||
    mode === "minibus" ||
    mode === "train" ||
    mode === "shared_cars" ||
    mode === "none"
  ) {
    return mode;
  }
  return "none";
}

function trimOptionalString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed === "" ? undefined : trimmed;
}

function startPointLocationFromForm(basic: DenaliWizardFormLike["basicInfo"]): string | undefined {
  return (
    denaliLocationAddressText(basic.startPoint) ??
    trimOptionalString(basic.startPointLocationText ?? basic.startPointVillage)
  );
}

function resolveLocationZonesFromForm(basic: DenaliWizardFormLike["basicInfo"]): {
  gatheringPoint?: DenaliLocationData;
  startPoint?: DenaliLocationData;
  summitPoint?: DenaliLocationData;
  campPoint?: DenaliLocationData;
  endPoint?: DenaliLocationData;
  meetingPoint?: string;
  startPointLocationText?: string;
} {
  const gatheringPoint =
    basic.gatheringPoint ?? denaliLocationFromText(trimOptionalString(basic.meetingPoint));
  const startPoint =
    basic.startPoint ?? denaliLocationFromText(startPointLocationFromForm(basic));
  const summitPoint = basic.summitPoint;
  const campPoint = basic.campPoint;
  const endPoint = basic.endPoint;
  return {
    gatheringPoint,
    startPoint,
    summitPoint,
    campPoint,
    endPoint,
    meetingPoint:
      denaliLocationAddressText(gatheringPoint) ?? trimOptionalString(basic.meetingPoint),
    startPointLocationText:
      denaliLocationAddressText(startPoint) ?? startPointLocationFromForm(basic),
  };
}

function hikingGoHoursFromForm(program: DenaliWizardFormLike["programNature"]): number | undefined {
  return program.hikingGoHours ?? program.hikingUpHours;
}

function hikingReturnHoursFromForm(
  program: DenaliWizardFormLike["programNature"],
): number | undefined {
  return program.hikingReturnHours ?? program.hikingDownHours;
}

function leaderUserIdsFromForm(ids: string[] | undefined): string[] | undefined {
  if (ids == null || ids.length === 0) return undefined;
  const normalized = ids.map((id) => id.trim()).filter((id) => id.length > 0);
  return normalized.length > 0 ? [...new Set(normalized)] : undefined;
}

function policiesTextFromForm(policies: DenaliWizardFormLike["policies"]): string | undefined {
  return trimOptionalString(policies.policiesText ?? policies.cancellationPolicy);
}

function pricingRequiresPaymentFromForm(
  pricing: DenaliWizardFormLike["pricingPayment"],
): boolean | undefined {
  if (pricing.requiresPayment === true) return true;
  if (pricing.requiresPayment === false) return undefined;
  const legacyPaid =
    denaliFormAmountToCanonical(
      pricing.basePriceWithPersonalCar ?? pricing.basePricePerPerson,
    ) != null;
  return legacyPaid ? true : undefined;
}

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function themeIdsFromProgramNature(program: DenaliWizardFormLike["programNature"]): string[] {
  const fromArray = Array.isArray(program.themeIds) ? program.themeIds : [];
  const normalized = fromArray
    .map((id) => (typeof id === "string" ? id.trim() : ""))
    .filter((id) => id.length > 0 && UUID_V4.test(id));
  if (normalized.length > 0) {
    return [...new Set(normalized)];
  }
  const legacy: string[] = [];
  const main = program.mainTourThemeId?.trim();
  if (main && UUID_V4.test(main)) legacy.push(main);
  for (const id of program.secondaryTourThemeIds ?? []) {
    const t = typeof id === "string" ? id.trim() : "";
    if (t && UUID_V4.test(t) && !legacy.includes(t)) legacy.push(t);
  }
  return legacy;
}

function difficultyLevelFromForm(
  level: number | string | undefined,
): number | undefined {
  if (typeof level === "number") return level;
  if (typeof level === "string") {
    if (level === "easy") return 2;
    if (level === "medium") return 5;
    if (level === "hard") return 8;
    const parsed = parseFloat(level);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
}

/**
 * Maps legacy `DenaliCreateTourWizardForm` to the Phase 4 canonical MVP model.
 * Missing classification defaults to mountain / single; missing strings default to "".
 */
export function denaliCanonicalFromForm(form: DenaliWizardFormLike): DenaliCanonicalTourModel {
  const basics =
    denaliCanonicalBasicsFromTourKind(form.basicInfo.tourType) ?? {
      category: "mountain" as const,
      duration: "single_day" as const,
    };

  const requiresPayment = pricingRequiresPaymentFromForm(form.pricingPayment);
  const locations = resolveLocationZonesFromForm(form.basicInfo);
  const gatheringPoints = resolveGatheringPointsFromForm(form);
  const primaryGathering = gatheringPoints[0];

  const transport = {
    mode: transportModeToCanonical(form.transport.transportMode),
    transportCost: denaliFormAmountToCanonical(form.transport.transportCost),
    allowPersonalCar:
      form.transport.allowPersonalCar === true ? true : undefined,
    dongAmount: denaliFormAmountToCanonical(form.transport.dongAmount),
    transportNotes: trimOptionalString(form.transport.transportNotes),
    adminCapacityApproval:
      form.transport.adminCapacityApproval === true ? true : undefined,
  };

  return {
    category: basics.category,
    duration: formDurationToCanonical(basics.duration),

    title: form.basicInfo.title?.trim() ?? "",
    destinationId: form.basicInfo.destinationId?.trim() ?? "",
    startDateTime: form.basicInfo.startDateTime?.trim() ?? "",
    endDateTime: trimOptionalString(form.basicInfo.endDateTime),
    capacityMax: denaliFormCapacityMaxToCanonical(form.basicInfo.capacityMax),
    capacityMin: form.basicInfo.capacityMin,
    meetingPoint:
      primaryGathering?.title.trim() ||
      denaliLocationAddressText(primaryGathering?.location) ||
      locations.meetingPoint,
    startPointLocationText: locations.startPointLocationText,
    gatheringPoint: primaryGathering?.location ?? locations.gatheringPoint,
    gatheringPoints: gatheringPoints.length > 0 ? gatheringPoints : undefined,
    startPoint: locations.startPoint,
    summitPoint: locations.summitPoint,
    campPoint: locations.campPoint,
    endPoint: locations.endPoint,
    approximateReturnTime: trimOptionalString(form.basicInfo.approximateReturnTime),
    leaderUserIds: leaderUserIdsFromForm(form.basicInfo.leaderUserIds),
    requiresLocalGuide: form.basicInfo.requiresLocalGuide === true ? true : undefined,
    localGuideName:
      form.basicInfo.requiresLocalGuide === true
        ? trimOptionalString(form.basicInfo.localGuideName)
        : undefined,
    requiresManualAdminApproval:
      form.basicInfo.requiresManualAdminApproval === true ? true : undefined,
    publishStatus:
      form.basicInfo.publishStatus === "active" ? "active" : "draft",
    socialMediaLink:
      trimOptionalString(form.basicInfo.socialMediaLink) ??
      trimOptionalString(form.basicInfo.telegramUrl) ??
      trimOptionalString(form.basicInfo.baleUrl) ??
      trimOptionalString(form.basicInfo.eitaaUrl),

    program: {
      themeIds: themeIdsFromProgramNature(form.programNature),
      shortDescription: form.programNature.shortDescription?.trim() ?? "",
      longDescription: trimOptionalString(form.programNature.longDescription),
      difficultyLevel: difficultyLevelFromForm(form.programNature.difficultyLevel),
      hikingHoursApprox: form.programNature.hikingHoursApprox,
      hikingGoHours: hikingGoHoursFromForm(form.programNature),
      hikingReturnHours: hikingReturnHoursFromForm(form.programNature),
      altitudeMeasurement: form.programNature.altitudeMeasurement,
      itinerary:
        form.programNature.itinerary != null && form.programNature.itinerary.length > 0
          ? form.programNature.itinerary.map((row) => ({
              day: row.day,
              activities: row.activities,
              ...(row.locationText?.trim() ? { locationText: row.locationText.trim() } : {}),
              ...(row.location != null &&
              (row.location.addressText?.trim() ||
                row.location.latitude != null ||
                row.location.longitude != null)
                ? {
                    location: {
                      addressText: row.location.addressText?.trim() ?? "",
                      latitude: row.location.latitude ?? null,
                      longitude: row.location.longitude ?? null,
                    },
                  }
                : {}),
              ...(row.photos != null && row.photos.length > 0 ? { photos: row.photos } : {}),
            }))
          : undefined,
    },

    transport,

    pricing: {
      requiresPayment,
      basePricePerPerson:
        requiresPayment === true
          ? denaliFormAmountToCanonical(
              form.pricingPayment.basePricePerPerson ??
                form.pricingPayment.basePriceWithPersonalCar,
            )
          : undefined,
      paymentMode: "offline_receipt",
      includesTourInsurance: form.pricingPayment.includesTourInsurance === true,
    },

    participants: {
      minimumAge: form.participantRequirements.minimumAge,
      maximumAge: form.participantRequirements.maximumAge,
      fitnessLevel: form.participantRequirements.fitnessLevel as DenaliCanonicalTourModel["participants"]["fitnessLevel"],
      nationalIdRequired:
        form.participantRequirements.nationalIdRequired !== false,
      sportsInsuranceRequired: form.participantRequirements.sportsInsuranceRequired,
      minRequiredPeaks:
        typeof form.participantRequirements.minRequiredPeaks === "number" &&
        Number.isInteger(form.participantRequirements.minRequiredPeaks) &&
        form.participantRequirements.minRequiredPeaks >= 1 &&
        form.participantRequirements.minRequiredPeaks <= 4
          ? form.participantRequirements.minRequiredPeaks
          : undefined,
      fitnessPrerequisiteText: trimOptionalString(
        form.participantRequirements.fitnessPrerequisiteText,
      ),
      gearItems:
        form.participantRequirements.gearItems != null &&
        form.participantRequirements.gearItems.length > 0
          ? form.participantRequirements.gearItems
          : undefined,
    },

    policies: {
      policiesText: policiesTextFromForm(form.policies),
      cancellationDeadlineHours: denaliFormAmountToCanonical(
        form.policies.cancellationDeadlineHours,
      ),
      cancellationPenaltyPercentage: denaliFormAmountToCanonical(
        form.policies.cancellationPenaltyPercentage,
      ),
    },
  };
}
