"use client";

import { useTranslations } from "next-intl";
import type { ComponentType } from "react";

import type { DenaliZodFieldKind } from "@repo/denali-domain";

import { DenaliApproximateReturnTimeField } from "@/features/tours/wizard/denali/DenaliApproximateReturnTimeField";
import { DenaliCustomServicesField } from "@/features/tours/wizard/denali/components/DenaliCustomServicesField";
import { DenaliGatheringPointsWidget } from "@/features/tours/wizard/denali/components/DenaliGatheringPointsWidget";
import { DenaliLocationZonesSection } from "@/features/tours/wizard/denali/components/DenaliLocationZoneField";
import { DenaliPeakExperienceField } from "@/features/tours/wizard/denali/components/DenaliPeakExperienceField";
import { DenaliDailyItinerarySection } from "@/features/tours/denali/widgets/DenaliDailyItinerarySection";
import { DenaliGearSection } from "@/features/tours/denali/widgets/DenaliGearSection";
import { DenaliProgramContentSection } from "@/features/tours/denali/widgets/DenaliProgramContentSection";

import { DenaliCanonicalFieldControl } from "./DenaliCanonicalFieldControl";
import type { DenaliZodKindFieldProps } from "./denaliZodKindFieldProps";

export type { DenaliZodKindFieldProps } from "./denaliZodKindFieldProps";

function gatheringPointsField(_props: DenaliZodKindFieldProps) {
  return <DenaliGatheringPointsWidget name="tripDetails.logistics.gatheringPoints" />;
}

function locationZonesField(_props: DenaliZodKindFieldProps) {
  return <DenaliLocationZonesSection />;
}

function gearField(_props: DenaliZodKindFieldProps) {
  return <DenaliGearSection />;
}

function itineraryField(_props: DenaliZodKindFieldProps) {
  return <DenaliDailyItinerarySection />;
}

function programContentField(_props: DenaliZodKindFieldProps) {
  return <DenaliProgramContentSection />;
}

function customServicesField(_props: DenaliZodKindFieldProps) {
  return <DenaliCustomServicesField />;
}

function peakExperienceField(_props: DenaliZodKindFieldProps) {
  return <DenaliPeakExperienceField />;
}

function ApproximateReturnField(_props: DenaliZodKindFieldProps) {
  const t = useTranslations("tours.denali");
  return <DenaliApproximateReturnTimeField label={t("basic.approximateReturnTime")} />;
}

/**
 * Maps registry `zodKind` to UI widgets for {@link DenaliFieldRenderer}.
 * Composite section bodies may still host fields not yet migrated to the renderer.
 */
export const DENALI_ZOD_KIND_COMPONENTS: Partial<
  Record<DenaliZodFieldKind, ComponentType<DenaliZodKindFieldProps>>
> = {
  title: DenaliCanonicalFieldControl,
  publishStatus: DenaliCanonicalFieldControl,
  destinationId: DenaliCanonicalFieldControl,
  isoDateTime: DenaliCanonicalFieldControl,
  isoDateTimeOptional: DenaliCanonicalFieldControl,
  capacityMax: DenaliCanonicalFieldControl,
  optionalInt: DenaliCanonicalFieldControl,
  optionalPositiveInt: DenaliCanonicalFieldControl,
  stringOptional: DenaliCanonicalFieldControl,
  stringArrayDefault: DenaliCanonicalFieldControl,
  booleanOptional: DenaliCanonicalFieldControl,
  socialMediaLink: DenaliCanonicalFieldControl,
  difficultyLevel: DenaliCanonicalFieldControl,
  paymentMode: DenaliCanonicalFieldControl,
  fitnessLevel: DenaliCanonicalFieldControl,
  transportMode: DenaliCanonicalFieldControl,
  adminCapacityApproval: DenaliCanonicalFieldControl,
  approximateReturnTime: ApproximateReturnField,
  itinerary: itineraryField,
  locationData: locationZonesField,
  gatheringPoints: gatheringPointsField,
  gearItems: gearField,
  photos: DenaliCanonicalFieldControl,
  minRequiredPeaks: peakExperienceField,
  tourType: DenaliCanonicalFieldControl,
};

export const DENALI_ZOD_KIND_ALIASES: Partial<
  Record<string, ComponentType<DenaliZodKindFieldProps>>
> = {
  "program.themeIds": programContentField,
  "tripDetails.logistics.customServiceLabels": customServicesField,
};
