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
  type DenaliCanonicalDuration,
  type DenaliCanonicalTourModel,
} from "@repo/types/denali";

import type { UseFormSetValue } from "react-hook-form";

import { applyDenaliInvariantState } from "./validation/denaliInvariantEngine";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliTourCreateSchema";

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
  return {
    ...base,
    ...patch,
    program: { ...base.program, ...patch.program },
    transport: { ...base.transport, ...patch.transport },
    pricing: { ...base.pricing, ...patch.pricing },
    participants: { ...base.participants, ...patch.participants },
    policies: { ...base.policies, ...patch.policies },
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
    gatheringPoints: form.tripDetails.logistics.gatheringPoints ?? base.gatheringPoints,
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
      altitudeMeasurement: form.programNature.altitudeMeasurement,
      itinerary: form.programNature.itinerary,
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
    photos: form.photosData?.photos,
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
  return {
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
      altitudeMeasurement: canonical.program.altitudeMeasurement,
      itinerary: canonical.program.itinerary,
    },
    transport: {
      ...existingForm.transport,
      transportMode: canonical.transport.mode,
      transportCost: canonical.transport.transportCost,
      allowPersonalCar: canonical.transport.allowPersonalCar,
      dongAmount: canonical.transport.dongAmount,
      transportNotes: canonical.transport.transportNotes,
    },
    tripDetails: {
      ...existingForm.tripDetails,
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
}

export { applyDenaliInvariantState };

export type ApplyCanonicalMvpToFormOptions = {
  basics?: DenaliCanonicalBasicsSelection | null;
  setValue: UseFormSetValue<DenaliCreateTourWizardForm>;
};

/** Writes MVP slices to RHF without resetting legacy fields. Returns the normalized form. */
export function applyCanonicalMvpToForm(
  canonical: DenaliCanonicalTourModel,
  existingForm: DenaliCreateTourWizardForm,
  { basics, setValue }: ApplyCanonicalMvpToFormOptions,
): DenaliCreateTourWizardForm {
  const nextRaw = denaliCanonicalToForm(canonical, existingForm, { basics });
  const next = applyDenaliInvariantState(nextRaw);

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
      altitudeMeasurement: next.programNature.altitudeMeasurement,
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
    },
    sync,
  );
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
