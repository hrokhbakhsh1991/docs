"use client";

import type { RenderFieldPlan } from "@app-tour/platform-core";
import React, { type ReactNode } from "react";

import type { TourWizardDraft } from "@/tours/tour-wizard-draft";

import type { DenaliImplementedCompositeId } from "./denali-composite-ids";
import { DenaliApproximateReturnTimeField } from "./denali-approximate-return-time-field";
import { DenaliCustomServicesField } from "./denali-custom-services-field";
import { DenaliDatetimeEndField } from "./denali-datetime-end-field";
import { DenaliDatetimeField, DENALI_DATETIME_TEST_IDS } from "./denali-datetime-field";
import { DenaliDestinationField } from "./denali-destination-field";
import { DenaliDifficultyLevelField } from "./denali-difficulty-level-field";
import { DenaliElevationGainField } from "./denali-elevation-gain-field";
import { DenaliGearField } from "./denali-gear-field";
import { DenaliGatheringPointsField } from "./denali-gathering-points-field";
import { DenaliItineraryField } from "./denali-itinerary-field";
import { DenaliLeaderUserIdsField } from "./denali-leader-user-ids-field";
import { DenaliLocationZonesField } from "./denali-location-zones-field";
import { DenaliPeakExperienceField } from "./denali-peak-experience-field";
import { DenaliPhotosField } from "./denali-photos-field";
import { DenaliPricingParticipantsField } from "./denali-pricing-participants-field";
import { DenaliPricingPaymentField } from "./denali-pricing-payment-field";
import { DenaliProgramContentField } from "./denali-program-content-field";
import { DenaliTourKindField } from "./denali-tour-kind-field";
import { DENALI_TOUR_KIND_VALUES } from "./denali-tour-kind-labels";
import { DenaliTransportModeField } from "./denali-transport-mode-field";

export { DENALI_IMPLEMENTED_COMPOSITE_IDS, isDenaliCompositeImplemented } from "./denali-composite-ids";
export type { DenaliImplementedCompositeId } from "./denali-composite-ids";

type DenaliCompositeRendererProps = {
  readonly field: RenderFieldPlan;
  readonly draft: TourWizardDraft;
  readonly onDraftChange: (draft: TourWizardDraft) => void;
  readonly wizardSessionId?: string;
  readonly workspaceFormProfile?: string;
};

type DenaliCompositeRenderer = (props: DenaliCompositeRendererProps) => ReactNode;

const DENALI_COMPOSITE_RENDERERS: Readonly<Record<DenaliImplementedCompositeId, DenaliCompositeRenderer>> =
  {
    "denali.tour-kind-basics": ({ draft, onDraftChange, field }) => (
      <DenaliTourKindField
        draft={draft}
        onDraftChange={onDraftChange}
        tourKindValues={DENALI_TOUR_KIND_VALUES}
        required={field.required}
      />
    ),
    "denali.destination": ({ field, draft, onDraftChange }) => (
      <DenaliDestinationField
        draft={draft}
        onDraftChange={onDraftChange}
        canonicalPath={field.canonicalPath}
        required={field.required}
      />
    ),
    "denali.datetime": ({ draft, onDraftChange, field }) => (
      <DenaliDatetimeField
        draft={draft}
        onDraftChange={onDraftChange}
        canonicalPath={field.canonicalPath}
        required={field.required}
        testId={DENALI_DATETIME_TEST_IDS.start}
      />
    ),
    "denali.datetime-end": ({ draft, onDraftChange, field }) => (
      <DenaliDatetimeEndField
        draft={draft}
        onDraftChange={onDraftChange}
        required={field.required}
      />
    ),
    "denali.location-zones": ({ draft, onDraftChange }) => (
      <DenaliLocationZonesField draft={draft} onDraftChange={onDraftChange} />
    ),
    "denali.gathering-points": ({ draft, onDraftChange }) => (
      <DenaliGatheringPointsField draft={draft} onDraftChange={onDraftChange} />
    ),
    "denali.transport-mode": ({ draft, onDraftChange, field }) => (
      <DenaliTransportModeField
        draft={draft}
        onDraftChange={onDraftChange}
        required={field.required}
      />
    ),
    "denali.difficulty-level": ({ draft, onDraftChange, field }) => (
      <DenaliDifficultyLevelField
        draft={draft}
        onDraftChange={onDraftChange}
        required={field.required}
      />
    ),
    "denali.elevation-gain": ({ draft, onDraftChange, field }) => (
      <DenaliElevationGainField
        draft={draft}
        onDraftChange={onDraftChange}
        required={field.required}
      />
    ),
    "denali.gear": ({ draft, onDraftChange }) => (
      <DenaliGearField draft={draft} onDraftChange={onDraftChange} />
    ),
    "denali.program-content": ({ draft, onDraftChange, workspaceFormProfile }) => (
      <DenaliProgramContentField
        draft={draft}
        onDraftChange={onDraftChange}
        workspaceFormProfile={workspaceFormProfile}
      />
    ),
    "denali.peak-experience": ({ draft, onDraftChange, field }) => (
      <DenaliPeakExperienceField
        draft={draft}
        onDraftChange={onDraftChange}
        required={field.required}
      />
    ),
    "denali.pricing-payment": ({ draft, onDraftChange }) => (
      <DenaliPricingPaymentField draft={draft} onDraftChange={onDraftChange} />
    ),
    "denali.pricing-participants": ({ draft, onDraftChange, field }) => (
      <DenaliPricingParticipantsField
        draft={draft}
        onDraftChange={onDraftChange}
        required={field.required}
      />
    ),
    "denali.approximate-return-time": ({ draft, onDraftChange, field }) => (
      <DenaliApproximateReturnTimeField
        draft={draft}
        onDraftChange={onDraftChange}
        required={field.required}
      />
    ),
    "denali.leader-user-ids": ({ draft, onDraftChange }) => (
      <DenaliLeaderUserIdsField draft={draft} onDraftChange={onDraftChange} />
    ),
    "denali.custom-services": ({ draft, onDraftChange }) => (
      <DenaliCustomServicesField draft={draft} onDraftChange={onDraftChange} />
    ),
    "denali.photos": ({ draft, onDraftChange, field, wizardSessionId }) => (
      <DenaliPhotosField
        draft={draft}
        onDraftChange={onDraftChange}
        required={field.required}
        wizardSessionId={wizardSessionId}
      />
    ),
    "denali.itinerary": ({ draft, onDraftChange, field }) => (
      <DenaliItineraryField draft={draft} onDraftChange={onDraftChange} required={field.required} />
    ),
  };

export function resolveDenaliCompositeRenderer(
  compositeId: string | undefined
): DenaliCompositeRenderer | null {
  if (compositeId === undefined || compositeId.length === 0) {
    return null;
  }
  return (
    DENALI_COMPOSITE_RENDERERS[compositeId as DenaliImplementedCompositeId] ?? null
  );
}
