"use client";

import { useTranslations } from "next-intl";
import type { ComponentType } from "react";
import { Button } from "@tour/ui";

import quickAddStyles from "@/components/shared/quick-add/QuickAddModal.module.css";
import type { DenaliZodFieldKind } from "@repo/denali-domain";

import { DenaliApproximateReturnTimeField } from "@/features/tours/wizard/denali/DenaliApproximateReturnTimeField";
import { DenaliCustomServicesField } from "@/features/tours/wizard/denali/components/DenaliCustomServicesField";
import { DenaliGatheringPointsWidget } from "@/features/tours/wizard/denali/components/DenaliGatheringPointsWidget";
import { DenaliLocationZonesSection } from "@/features/tours/wizard/denali/components/DenaliLocationZoneField";
import { DenaliPeakExperienceField } from "@/features/tours/wizard/denali/components/DenaliPeakExperienceField";
import { useDenaliEquipmentQuickAdd } from "@/features/tours/wizard/denali/application";
import {
  DENALI_FIELD_HINTS,
  denaliFieldHintStyle,
} from "@/features/tours/wizard/denali/denaliFieldHints";
import { DenaliDailyItinerarySection } from "@/features/tours/denali/widgets/DenaliDailyItinerarySection";
import { DenaliGearSection } from "@/features/tours/denali/widgets/DenaliGearSection";
import { DenaliProgramContentSection } from "@/features/tours/denali/widgets/DenaliProgramContentSection";

import { DenaliCanonicalFieldControl } from "./DenaliCanonicalFieldControl";
import type { DenaliZodKindFieldProps } from "./denaliZodKindFieldProps";
import { DenaliDestinationField } from "./widgets/DenaliDestinationField";
import { DenaliDifficultyLevelField } from "./widgets/DenaliDifficultyLevelField";
import { DenaliElevationGainField } from "./widgets/DenaliElevationGainField";
import { DenaliLeaderUserIdsField } from "./widgets/DenaliLeaderUserIdsField";
import { DenaliPhotosField } from "./widgets/DenaliPhotosField";
import { DenaliPricingParticipantsField } from "./widgets/DenaliPricingParticipantsField";
import { DenaliRegistryDatetimeField } from "./widgets/DenaliRegistryDatetimeField";
import { DenaliTourKindBasicsField } from "./widgets/DenaliTourKindBasicsField";
import { DenaliTransportModeField } from "./widgets/DenaliTransportModeField";

export type { DenaliZodKindFieldProps } from "./denaliZodKindFieldProps";

function gatheringPointsField(_props: DenaliZodKindFieldProps) {
  return (
    <div style={{ display: "grid", gap: "0.5rem" }}>
      <p style={{ ...denaliFieldHintStyle, margin: 0 }} dir="rtl">
        {DENALI_FIELD_HINTS.gatheringStations}
      </p>
      <DenaliGatheringPointsWidget name="tripDetails.logistics.gatheringPoints" />
    </div>
  );
}

function locationZonesField(_props: DenaliZodKindFieldProps) {
  return <DenaliLocationZonesSection />;
}

function GearField(_props: DenaliZodKindFieldProps) {
  const openEquipmentQuickAdd = useDenaliEquipmentQuickAdd();
  return (
    <div style={{ display: "grid", gap: "0.5rem" }}>
      <div
        className={quickAddStyles.quickAddRow}
        data-testid="denali-logistics-quick-add"
        dir="rtl"
      >
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={openEquipmentQuickAdd}
          data-testid="denali-quick-add-equipment"
        >
          + تجهیز
        </Button>
      </div>
      <DenaliGearSection />
    </div>
  );
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

/** Maps registry `zodKind` to UI widgets for {@link DenaliFieldRenderer}. */
export const DENALI_ZOD_KIND_COMPONENTS: Partial<
  Record<DenaliZodFieldKind, ComponentType<DenaliZodKindFieldProps>>
> = {
  title: DenaliCanonicalFieldControl,
  publishStatus: DenaliCanonicalFieldControl,
  destinationId: DenaliDestinationField,
  isoDateTime: DenaliRegistryDatetimeField,
  isoDateTimeOptional: DenaliRegistryDatetimeField,
  capacityMax: DenaliCanonicalFieldControl,
  optionalInt: DenaliCanonicalFieldControl,
  optionalPositiveInt: DenaliCanonicalFieldControl,
  stringOptional: DenaliCanonicalFieldControl,
  stringArrayDefault: DenaliCanonicalFieldControl,
  booleanOptional: DenaliCanonicalFieldControl,
  socialMediaLink: DenaliCanonicalFieldControl,
  difficultyLevel: DenaliDifficultyLevelField,
  paymentMode: DenaliCanonicalFieldControl,
  fitnessLevel: DenaliCanonicalFieldControl,
  transportMode: DenaliTransportModeField,
  adminCapacityApproval: DenaliCanonicalFieldControl,
  approximateReturnTime: ApproximateReturnField,
  itinerary: itineraryField,
  locationData: locationZonesField,
  gatheringPoints: gatheringPointsField,
  gearItems: GearField,
  photos: DenaliPhotosField,
  minRequiredPeaks: peakExperienceField,
  tourType: DenaliTourKindBasicsField,
};

export const DENALI_ZOD_KIND_ALIASES: Partial<
  Record<string, ComponentType<DenaliZodKindFieldProps>>
> = {
  "program.themeIds": programContentField,
  "tripDetails.overview.customServiceLabels": customServicesField,
  "leaderUserIds": DenaliLeaderUserIdsField,
  "tripDetails.metrics.elevationGain": DenaliElevationGainField,
  "participants.minimumAge": DenaliPricingParticipantsField,
};
