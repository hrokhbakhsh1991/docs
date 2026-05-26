/**
 * Phase 5: canonical ↔ legacy form adapter (boundary only).
 *
 * Pure mapping for MVP wizard fields. Legacy-only slices (gear, altitude, secondary themes, …)
 * are preserved on {@link denaliCanonicalToForm} via `existingForm` spread — not read or written
 * on the canonical model.
 */

import {
  denaliCanonicalBasicsFromTourKind,
  denaliTourKindFromCanonical,
  type DenaliCanonicalBasicsSelection,
  type DenaliTourDuration,
} from "@repo/types";
import {
  denaliCanonicalFromForm,
  pickDenaliCanonicalGalleryPhotos,
  pickDenaliCanonicalItineraryDayPhotos,
  type DenaliCanonicalDuration,
  type DenaliCanonicalTourModel,
  type DenaliCanonicalTransportMode,
} from "@repo/types/denali";

import type { UseFormSetValue } from "react-hook-form";

import type { DenaliRuleSet } from "./rules/denaliRuleModel";
import { denaliRuleSet } from "./rules/denaliRuleModel";
import { applyDenaliInvariantState } from "./validation/denaliInvariantEngine";
import type { DenaliUIContextOptions } from "./rules/denaliUIAdapter";
import { readDenaliCanonicalBasics } from "./denaliCanonicalBasicsControl";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliTourCreateSchema";

import { normalizeCustomServiceLabels } from "@/features/tours/wizard/domain/normalizeCustomServiceLabels";

function customServiceLabelsFromForm(
  form: DenaliCreateTourWizardForm,
): string[] | undefined {
  return normalizeCustomServiceLabels(form.tripDetails?.overview?.customServiceLabels);
}

function customServiceLabelsToFormOverview(
  canonical: DenaliCanonicalTourModel,
  existingForm: DenaliCreateTourWizardForm,
): string[] {
  return (
    canonical.customServiceLabels ??
    existingForm.tripDetails?.overview?.customServiceLabels ??
    []
  );
}

function nonAttendanceDetailsFromForm(
  form: DenaliCreateTourWizardForm,
): string | undefined {
  const trimmed = form.tripDetails?.overview?.nonAttendanceDetails?.trim();
  return trimmed === "" ? undefined : trimmed;
}

function nonAttendanceDetailsFromCanonical(
  canonical: DenaliCanonicalTourModel,
): string | undefined {
  const trimmed = canonical.overview?.nonAttendanceDetails?.trim();
  return trimmed === "" ? undefined : trimmed;
}

function nonAttendanceDetailsToFormOverview(
  canonical: DenaliCanonicalTourModel,
  existingForm: DenaliCreateTourWizardForm,
): string | undefined {
  return (
    nonAttendanceDetailsFromCanonical(canonical) ??
    nonAttendanceDetailsFromForm(existingForm)
  );
}

function peakHeightFromForm(form: DenaliCreateTourWizardForm): number | undefined {
  const value =
    form.tripDetails?.overview?.peakHeight ?? form.programNature.altitudeMeasurement;
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function peakHeightFromCanonical(canonical: DenaliCanonicalTourModel): number | undefined {
  const value = canonical.overview?.peakHeight;
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function elevationGainFromForm(form: DenaliCreateTourWizardForm): number | undefined {
  const value =
    form.tripDetails?.metrics?.elevationGain ?? form.programNature.altitudeGainApprox;
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function elevationGainFromCanonical(canonical: DenaliCanonicalTourModel): number | undefined {
  const value = canonical.metrics?.elevationGain;
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function overviewToCanonical(
  form: DenaliCreateTourWizardForm,
  base: DenaliCanonicalTourModel,
): DenaliCanonicalTourModel["overview"] | undefined {
  const nonAttendanceDetails =
    nonAttendanceDetailsFromForm(form) ?? nonAttendanceDetailsFromCanonical(base);
  const peakHeight = peakHeightFromForm(form) ?? peakHeightFromCanonical(base);
  const next: NonNullable<DenaliCanonicalTourModel["overview"]> = {
    ...base.overview,
    ...(nonAttendanceDetails != null ? { nonAttendanceDetails } : {}),
    ...(peakHeight != null ? { peakHeight } : {}),
  };
  return Object.keys(next).length > 0 ? next : undefined;
}

function metricsToCanonical(
  form: DenaliCreateTourWizardForm,
  base: DenaliCanonicalTourModel,
): DenaliCanonicalTourModel["metrics"] | undefined {
  const elevationGain = elevationGainFromForm(form) ?? elevationGainFromCanonical(base);
  if (elevationGain == null) {
    return base.metrics;
  }
  return { ...base.metrics, elevationGain };
}

function transportModeToCanonical(
  mode: DenaliCreateTourWizardForm["transport"]["transportMode"] | undefined,
): DenaliCanonicalTransportMode {
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

/** True when `basicInfo.tourType` resolves to a known Denali tour kind slug. */
export function isDenaliWizardTourTypeSelected(form: DenaliCreateTourWizardForm): boolean {
  return readDenaliCanonicalBasics(form.basicInfo.tourType) != null;
}

/**
 * Unclassified canonical shell for first paint / empty tour-type — no {@link denaliCanonicalFromForm}.
 * `category` / `duration` are structural placeholders only; provider `basicsSelection`
 * (empty until tour kind is chosen) drives rule UI.
 */
export function createInitialDenaliCanonicalModel(
  form: DenaliCreateTourWizardForm,
): DenaliCanonicalTourModel {
  const requiresPayment = form.pricingPayment.requiresPayment === true;
  const gatheringPoints = form.tripDetails?.logistics?.gatheringPoints;
  return {
    category: "mountain",
    duration: "single",
    title: form.basicInfo.title?.trim() ?? "",
    destinationId: form.basicInfo.destinationId?.trim() ?? "",
    startDateTime: form.basicInfo.startDateTime?.trim() ?? "",
    endDateTime: form.basicInfo.endDateTime?.trim() || undefined,
    capacityMax: form.basicInfo.capacityMax,
    capacityMin: form.basicInfo.capacityMin,
    startPointLocationText: form.basicInfo.startPointLocationText,
    startPoint: form.basicInfo.startPoint,
    summitPoint: form.basicInfo.summitPoint,
    campPoint: form.basicInfo.campPoint,
    endPoint: form.basicInfo.endPoint,
    gatheringPoints:
      gatheringPoints != null && gatheringPoints.length > 0 ? gatheringPoints : undefined,
    customServiceLabels: customServiceLabelsFromForm(form),
    overview: overviewToCanonical(form, {}),
    metrics: metricsToCanonical(form, {}),
    approximateReturnTime: form.basicInfo.approximateReturnTime,
    leaderUserIds:
      form.basicInfo.leaderUserIds != null && form.basicInfo.leaderUserIds.length > 0
        ? form.basicInfo.leaderUserIds
        : undefined,
    requiresLocalGuide: form.basicInfo.requiresLocalGuide === true ? true : undefined,
    localGuideName:
      form.basicInfo.requiresLocalGuide === true
        ? form.basicInfo.localGuideName
        : undefined,
    requiresManualAdminApproval:
      form.basicInfo.requiresManualAdminApproval === true ? true : undefined,
    publishStatus: form.basicInfo.publishStatus === "active" ? "active" : "draft",
    socialMediaLink:
      form.basicInfo.socialMediaLink ??
      (form.basicInfo as { telegramUrl?: string }).telegramUrl ??
      (form.basicInfo as { baleUrl?: string }).baleUrl ??
      (form.basicInfo as { eitaaUrl?: string }).eitaaUrl,
    program: {
      themeIds: form.programNature.themeIds ?? [],
      shortDescription: form.programNature.shortDescription?.trim() ?? "",
      longDescription: form.programNature.longDescription,
      difficultyLevel: form.programNature.difficultyLevel,
      hikingHoursApprox: form.programNature.hikingHoursApprox,
      hikingGoHours: form.programNature.hikingGoHours,
      hikingReturnHours: form.programNature.hikingReturnHours,
      itinerary:
        form.programNature.itinerary != null && form.programNature.itinerary.length > 0
          ? form.programNature.itinerary.map((row) => {
              const dayPhotos = pickDenaliCanonicalItineraryDayPhotos(row.photos);
              return {
                day: row.day,
                activities: row.activities,
                ...(row.locationText?.trim() ? { locationText: row.locationText.trim() } : {}),
                ...(row.location != null ? { location: row.location } : {}),
                ...(dayPhotos != null && dayPhotos.length > 0 ? { photos: dayPhotos } : {}),
              };
            })
          : form.programNature.itinerary,
    },
    transport: {
      mode: transportModeToCanonical(form.transport.transportMode),
      dongAmount: form.transport.dongAmount,
      transportNotes: form.transport.transportNotes,
      allowPersonalCar: form.transport.allowPersonalCar === true ? true : undefined,
      adminCapacityApproval:
        form.transport.adminCapacityApproval === true ? true : undefined,
    },
    pricing: {
      requiresPayment: requiresPayment ? true : undefined,
      basePricePerPerson: requiresPayment ? form.pricingPayment.basePricePerPerson : undefined,
      paymentMode: "offline_receipt",
      includesTourInsurance: form.pricingPayment.includesTourInsurance === true,
    },
    participants: {
      minimumAge: form.participantRequirements.minimumAge,
      maximumAge: form.participantRequirements.maximumAge,
      fitnessLevel: form.participantRequirements.fitnessLevel,
      nationalIdRequired: form.participantRequirements.nationalIdRequired !== false,
      sportsInsuranceRequired: form.participantRequirements.sportsInsuranceRequired,
      minRequiredPeaks: form.participantRequirements.minRequiredPeaks,
      fitnessPrerequisiteText: form.participantRequirements.fitnessPrerequisiteText,
      gearItems: form.participantRequirements.gearItems,
    },
    policies: {
      policiesText: form.policies.policiesText,
      cancellationDeadlineHours: form.policies.cancellationDeadlineHours,
      cancellationPenaltyPercentage: form.policies.cancellationPenaltyPercentage,
    },
    photos: pickDenaliCanonicalGalleryPhotos(form.photosData?.photos),
  };
}

/**
 * Render-safe mapping — avoids {@link DenaliCanonicalTourTypeRequiredError} before tour type is chosen.
 * Submit / upload paths must use {@link denaliFormToCanonical} (strict).
 */
export function safeDenaliFormToCanonical(form: DenaliCreateTourWizardForm): DenaliCanonicalTourModel {
  if (!isDenaliWizardTourTypeSelected(form)) {
    return createInitialDenaliCanonicalModel(form);
  }
  return denaliFormToCanonical(form);
}

function canonicalDurationToFormDuration(duration: DenaliCanonicalDuration): DenaliTourDuration {
  return duration === "multi" ? "multi_day" : "single_day";
}

function tourTypeFromCanonical(
  canonical: DenaliCanonicalTourModel,
  existingTourType: DenaliCreateTourWizardForm["basicInfo"]["tourType"],
  basicsOverride?: DenaliCanonicalBasicsSelection | null,
): DenaliCreateTourWizardForm["basicInfo"]["tourType"] {
  const priorBasics = basicsOverride ?? denaliCanonicalBasicsFromTourKind(existingTourType);
  return denaliTourKindFromCanonical({
    category: canonical.category,
    duration: canonicalDurationToFormDuration(canonical.duration),
    eventVariant: priorBasics?.eventVariant,
  });
}

export type DenaliCanonicalPartial = {
  [K in keyof DenaliCanonicalTourModel]?: DenaliCanonicalTourModel[K] extends object
    ? Partial<DenaliCanonicalTourModel[K]>
    : DenaliCanonicalTourModel[K];
};

/** Deep-merge MVP canonical slices (no business rules). */
export function mergeDenaliCanonicalPartial(
  base: DenaliCanonicalTourModel,
  patch: DenaliCanonicalPartial,
): DenaliCanonicalTourModel {
  const merged = {
    ...base,
    ...patch,
    program: { ...base.program, ...patch.program },
    transport: { ...base.transport, ...patch.transport },
    pricing: { ...base.pricing, ...patch.pricing },
    participants: { ...base.participants, ...patch.participants },
    policies: { ...base.policies, ...patch.policies },
    overview: { ...base.overview, ...patch.overview },
    metrics: { ...base.metrics, ...patch.metrics },
  };

  return {
    ...merged,
  };
}

export function canonicalDurationToBasicsDuration(
  duration: DenaliCanonicalDuration,
): DenaliTourDuration {
  return duration === "multi" ? "multi_day" : "single_day";
}

export function basicsDurationToCanonicalDuration(
  duration: DenaliTourDuration,
): DenaliCanonicalDuration {
  return duration === "multi_day" ? "multi" : "single";
}

/**
 * Legacy wizard form → flat canonical MVP model.
 * Delegates to `@repo/types` — single source for forward mapping.
 */
export function denaliFormToCanonical(form: DenaliCreateTourWizardForm): DenaliCanonicalTourModel {
  const base = denaliCanonicalFromForm(form);
  return {
    ...base,
    startPointLocationText:
      form.basicInfo.startPointLocationText ?? base.startPointLocationText,
    startPoint: form.basicInfo.startPoint ?? base.startPoint,
    summitPoint: form.basicInfo.summitPoint ?? base.summitPoint,
    campPoint: form.basicInfo.campPoint ?? base.campPoint,
    endPoint: form.basicInfo.endPoint ?? base.endPoint,
    gatheringPoints:
      form.tripDetails?.logistics?.gatheringPoints ?? base.gatheringPoints,
    customServiceLabels:
      customServiceLabelsFromForm(form) ?? base.customServiceLabels,
    overview: overviewToCanonical(form, base),
    metrics: metricsToCanonical(form, base),
    approximateReturnTime: form.basicInfo.approximateReturnTime ?? base.approximateReturnTime,
    socialMediaLink:
      form.basicInfo.socialMediaLink ??
      (form.basicInfo as any).telegramUrl ??
      (form.basicInfo as any).baleUrl ??
      (form.basicInfo as any).eitaaUrl ??
      base.socialMediaLink,
    leaderUserIds:
      form.basicInfo.leaderUserIds != null && form.basicInfo.leaderUserIds.length > 0
        ? form.basicInfo.leaderUserIds
        : base.leaderUserIds,
    requiresLocalGuide:
      form.basicInfo.requiresLocalGuide === true
        ? true
        : form.basicInfo.requiresLocalGuide === false
          ? undefined
          : base.requiresLocalGuide,
    localGuideName:
      form.basicInfo.requiresLocalGuide === true
        ? form.basicInfo.localGuideName ?? base.localGuideName
        : undefined,
    requiresManualAdminApproval:
      form.basicInfo.requiresManualAdminApproval === true
        ? true
        : base.requiresManualAdminApproval,
    publishStatus: form.basicInfo.publishStatus ?? "draft",
    program: {
      ...base.program,
      difficultyLevel: form.programNature.difficultyLevel,
      hikingHoursApprox: form.programNature.hikingHoursApprox,
      hikingGoHours: form.programNature.hikingGoHours,
      hikingReturnHours: form.programNature.hikingReturnHours,
      itinerary:
        form.programNature.itinerary != null && form.programNature.itinerary.length > 0
          ? form.programNature.itinerary.map((row) => {
              const dayPhotos = pickDenaliCanonicalItineraryDayPhotos(row.photos);
              return {
                day: row.day,
                activities: row.activities,
                ...(row.locationText?.trim() ? { locationText: row.locationText.trim() } : {}),
                ...(row.location != null ? { location: row.location } : {}),
                ...(dayPhotos != null && dayPhotos.length > 0 ? { photos: dayPhotos } : {}),
              };
            })
          : form.programNature.itinerary,
      themeIds: form.programNature.themeIds ?? base.program.themeIds,
    },
    participants: {
      ...base.participants,
      fitnessLevel: form.participantRequirements.fitnessLevel,
      maximumAge: form.participantRequirements.maximumAge,
      nationalIdRequired: form.participantRequirements.nationalIdRequired,
      sportsInsuranceRequired: form.participantRequirements.sportsInsuranceRequired,
      minRequiredPeaks: form.participantRequirements.minRequiredPeaks,
      fitnessPrerequisiteText: form.participantRequirements.fitnessPrerequisiteText,
      gearItems: form.participantRequirements.gearItems,
    },
    pricing: {
      ...base.pricing,
      requiresPayment:
        form.pricingPayment.requiresPayment === true
          ? true
          : form.pricingPayment.requiresPayment === false
            ? undefined
            : base.pricing.requiresPayment,
      basePricePerPerson:
        form.pricingPayment.requiresPayment === true
          ? (form.pricingPayment.basePricePerPerson ?? base.pricing.basePricePerPerson)
          : undefined,
      includesTourInsurance: form.pricingPayment.includesTourInsurance === true,
      paymentMode: "offline_receipt",
    },
    policies: {
      policiesText: form.policies.policiesText ?? base.policies.policiesText,
      cancellationDeadlineHours: form.policies.cancellationDeadlineHours,
      cancellationPenaltyPercentage: form.policies.cancellationPenaltyPercentage,
    },
    photos: pickDenaliCanonicalGalleryPhotos(form.photosData?.photos),
  };
}

/**
 * Flat canonical MVP model → legacy wizard form.
 * Merges MVP slices onto `existingForm` so non-MVP fields are untouched.
 */
export function denaliCanonicalToForm(
  canonical: DenaliCanonicalTourModel,
  existingForm: DenaliCreateTourWizardForm,
  options?: { basics?: DenaliCanonicalBasicsSelection | null },
): DenaliCreateTourWizardForm {
  const result = {
    ...existingForm,
    basicInfo: {
      ...existingForm.basicInfo,
      title: canonical.title,
      tourType: tourTypeFromCanonical(canonical, existingForm.basicInfo.tourType, options?.basics),
      destinationId: canonical.destinationId,
      startDateTime: canonical.startDateTime,
      endDateTime: canonical.endDateTime,
      capacityMax: canonical.capacityMax,
      capacityMin: canonical.capacityMin,
      meetingPoint: canonical.meetingPoint,
      startPointLocationText: canonical.startPointLocationText,
      startPoint: canonical.startPoint,
      summitPoint: canonical.summitPoint,
      campPoint: canonical.campPoint,
      endPoint: canonical.endPoint,
      approximateReturnTime: canonical.approximateReturnTime,
      leaderUserIds: canonical.leaderUserIds ?? [],
      requiresLocalGuide: canonical.requiresLocalGuide === true,
      localGuideName: canonical.localGuideName,
      requiresManualAdminApproval: canonical.requiresManualAdminApproval === true,
      socialMediaLink: canonical.socialMediaLink,
      publishStatus: canonical.publishStatus ?? "draft",
    },
    programNature: {
      ...existingForm.programNature,
      themeIds: [...(canonical.program.themeIds ?? [])],
      shortDescription: canonical.program.shortDescription,
      longDescription: canonical.program.longDescription,
      difficultyLevel: canonical.program.difficultyLevel,
      hikingHoursApprox: canonical.program.hikingHoursApprox,
      hikingGoHours: canonical.program.hikingGoHours,
      hikingReturnHours: canonical.program.hikingReturnHours,
      itinerary: canonical.program.itinerary,
    },
    transport: {
      ...existingForm.transport,
      transportMode: canonical.transport.mode,
      transportCost: canonical.transport.transportCost,
      allowPersonalCar: canonical.transport.allowPersonalCar,
      dongAmount: canonical.transport.dongAmount,
      transportNotes: canonical.transport.transportNotes,
      adminCapacityApproval: canonical.transport.adminCapacityApproval,
    },
    tripDetails: {
      ...existingForm.tripDetails,
      overview: {
        ...existingForm.tripDetails?.overview,
        customServiceLabels: customServiceLabelsToFormOverview(canonical, existingForm),
        nonAttendanceDetails: nonAttendanceDetailsToFormOverview(canonical, existingForm),
        peakHeight: peakHeightFromCanonical(canonical) ?? peakHeightFromForm(existingForm),
      },
      metrics: {
        elevationGain:
          elevationGainFromCanonical(canonical) ?? elevationGainFromForm(existingForm),
      },
      logistics: {
        ...existingForm.tripDetails?.logistics,
        gatheringPoints: canonical.gatheringPoints ?? [],
      },
    },
    pricingPayment: {
      ...existingForm.pricingPayment,
      requiresPayment: canonical.pricing.requiresPayment === true,
      basePricePerPerson: canonical.pricing.basePricePerPerson,
      paymentMode: canonical.pricing.paymentMode,
      includesTourInsurance: canonical.pricing.includesTourInsurance === true,
    },
    participantRequirements: {
      ...existingForm.participantRequirements,
      minimumAge: canonical.participants.minimumAge,
      maximumAge: canonical.participants.maximumAge,
      fitnessLevel: canonical.participants.fitnessLevel,
      nationalIdRequired: canonical.participants.nationalIdRequired === true,
      sportsInsuranceRequired: canonical.participants.sportsInsuranceRequired,
      minRequiredPeaks: canonical.participants.minRequiredPeaks,
      fitnessPrerequisiteText: canonical.participants.fitnessPrerequisiteText,
      gearItems: canonical.participants.gearItems,
    },
    policies: {
      ...existingForm.policies,
      policiesText: canonical.policies.policiesText,
      cancellationDeadlineHours: canonical.policies.cancellationDeadlineHours,
      cancellationPenaltyPercentage: canonical.policies.cancellationPenaltyPercentage,
    },
    photosData: {
      ...existingForm.photosData,
      photos: canonical.photos ?? [],
    },
  };
  return result;
}

export { applyDenaliInvariantState };

export type ApplyCanonicalMvpToFormOptions = {
  basics?: DenaliCanonicalBasicsSelection | null;
  setValue: UseFormSetValue<DenaliCreateTourWizardForm>;
  /** Workspace overlay rule set; defaults to static {@link denaliRuleSet}. */
  ruleSet?: DenaliRuleSet;
  uiOptions?: DenaliUIContextOptions;
};

/** Writes MVP slices to RHF without resetting legacy fields. Returns the normalized form. */
export function applyCanonicalMvpToForm(
  canonical: DenaliCanonicalTourModel,
  existingForm: DenaliCreateTourWizardForm,
  { basics, setValue, ruleSet = denaliRuleSet, uiOptions }: ApplyCanonicalMvpToFormOptions,
): DenaliCreateTourWizardForm {
  const nextRaw = denaliCanonicalToForm(canonical, existingForm, { basics });
  const next = applyDenaliInvariantState(nextRaw, uiOptions, ruleSet);

  const sync = { shouldDirty: true, shouldValidate: true } as const;

  setValue("basicInfo", next.basicInfo, sync);
  setValue(
    "programNature",
    {
      ...existingForm.programNature,
      themeIds: next.programNature.themeIds,
      shortDescription: next.programNature.shortDescription,
      longDescription: next.programNature.longDescription,
      difficultyLevel: next.programNature.difficultyLevel,
      hikingHoursApprox: next.programNature.hikingHoursApprox,
      hikingGoHours: next.programNature.hikingGoHours,
      hikingReturnHours: next.programNature.hikingReturnHours,
      itinerary: next.programNature.itinerary,
    },
    sync,
  );
  setValue(
    "transport",
    {
      ...existingForm.transport,
      transportMode: next.transport.transportMode,
      transportCost: next.transport.transportCost,
      allowPersonalCar: next.transport.allowPersonalCar,
      dongAmount: next.transport.dongAmount,
      transportNotes: next.transport.transportNotes,
      adminCapacityApproval: next.transport.adminCapacityApproval,
    },
    sync,
  );
  setValue("basicInfo.capacityMax", next.basicInfo.capacityMax, sync);
  setValue(
    "pricingPayment",
    {
      ...existingForm.pricingPayment,
      requiresPayment: next.pricingPayment.requiresPayment,
      basePricePerPerson: next.pricingPayment.basePricePerPerson,
      paymentMode: next.pricingPayment.paymentMode,
      includesTourInsurance: next.pricingPayment.includesTourInsurance,
    },
    sync,
  );
  setValue(
    "participantRequirements",
    {
      ...existingForm.participantRequirements,
      minimumAge: next.participantRequirements.minimumAge,
      maximumAge: next.participantRequirements.maximumAge,
      fitnessLevel: next.participantRequirements.fitnessLevel,
      nationalIdRequired: next.participantRequirements.nationalIdRequired,
      sportsInsuranceRequired: next.participantRequirements.sportsInsuranceRequired,
      fitnessPrerequisiteText: next.participantRequirements.fitnessPrerequisiteText,
      gearItems: next.participantRequirements.gearItems,
    },
    sync,
  );
  setValue(
    "policies",
    {
      policiesText: next.policies.policiesText,
      cancellationDeadlineHours: next.policies.cancellationDeadlineHours,
      cancellationPenaltyPercentage: next.policies.cancellationPenaltyPercentage,
    },
    sync,
  );
  setValue("photosData", { photos: next.photosData.photos }, sync);
  setValue("tripDetails", next.tripDetails, sync);

  return next;
}
