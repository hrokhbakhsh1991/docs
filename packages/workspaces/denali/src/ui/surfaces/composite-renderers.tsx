"use client";

import type { RenderFieldPlan } from "@app-tour/platform-core";
import type { ReactNode } from "react";

import type { DenaliTourWizardDraft } from "../../draft/denali-tour-wizard-draft";
import type { DenaliImplementedCompositeId } from "./composite-ids";
import { DenaliApproximateReturnTimeField } from "../fields/denali-approximate-return-time-field";
import { DenaliCustomServicesField } from "../fields/denali-custom-services-field";
import { DenaliDatetimeEndField } from "../fields/denali-datetime-end-field";
import {
  DenaliDatetimeField,
  DENALI_DATETIME_TEST_IDS,
} from "../fields/denali-datetime-field";
import { DenaliDestinationField } from "../fields/denali-destination-field";
import { DenaliDifficultyLevelField } from "../fields/denali-difficulty-level-field";
import { DenaliElevationGainField } from "../fields/denali-elevation-gain-field";
import { DenaliGearField } from "../fields/denali-gear-field";
import { DenaliGatheringPointsField } from "../fields/denali-gathering-points-field";
import { DenaliGuideLanguageIdsField } from "../fields/denali-guide-language-ids-field";
import { DenaliItineraryField } from "../fields/denali-itinerary-field";
import { DenaliLeaderUserIdsField } from "../fields/denali-leader-user-ids-field";
import { DenaliLocationZonesField } from "../fields/denali-location-zones-field";
import { DenaliPeakExperienceField } from "../fields/denali-peak-experience-field";
import { DenaliPhotosField } from "../fields/denali-photos-field";
import { DenaliPricingParticipantsField } from "../fields/denali-pricing-participants-field";
import { DenaliPricingPaymentField } from "../fields/denali-pricing-payment-field";
import { DenaliProgramContentField } from "../fields/denali-program-content-field";
import { DenaliSocialMediaLinkField } from "../fields/denali-social-media-link-field";
import { DenaliTourKindField } from "../fields/denali-tour-kind-field";
import { DenaliTourServicesField } from "../fields/denali-tour-services-field";
import { DenaliTransportModeField } from "../fields/denali-transport-mode-field";

export { DENALI_IMPLEMENTED_COMPOSITE_IDS, isDenaliCompositeImplemented } from "./composite-ids";
export type { DenaliImplementedCompositeId } from "./composite-ids";

type DenaliCompositeRendererProps = {
  readonly field: RenderFieldPlan;
  readonly draft: DenaliTourWizardDraft;
  readonly onDraftChange: (draft: DenaliTourWizardDraft) => void;
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
    "denali.social-media-link": ({ draft, onDraftChange, field }) => (
      <DenaliSocialMediaLinkField
        draft={draft}
        onDraftChange={onDraftChange}
        required={field.required}
      />
    ),
    "denali.guide-language-ids": ({ draft, onDraftChange }) => (
      <DenaliGuideLanguageIdsField draft={draft} onDraftChange={onDraftChange} />
    ),
    "denali.custom-services": ({ draft, onDraftChange }) => (
      <DenaliCustomServicesField draft={draft} onDraftChange={onDraftChange} />
    ),
    "denali.tour-services": ({ draft, onDraftChange }) => (
      <DenaliTourServicesField draft={draft} onDraftChange={onDraftChange} />
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
