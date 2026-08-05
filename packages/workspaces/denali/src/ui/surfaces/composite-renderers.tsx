"use client";

import type { RenderFieldPlan } from "@app-tour/platform-core";
import type { ReactNode } from "react";

import type { DenaliTourWizardDraft } from "../../draft/denali-tour-wizard-draft";
import type { DenaliWizardRuleEvalContext } from "../../wizard/denali-wizard-rule-eval-context";
import type { DenaliImplementedCompositeId } from "./composite-ids";
import { DenaliApproximateReturnTimeField } from "../fields/denali-approximate-return-time-field";
import { DenaliCustomServicesField } from "../fields/denali-custom-services-field";
import { DenaliDatetimeEndField } from "../fields/denali-datetime-end-field";
import {
  DenaliDatetimeField,
  DENALI_DATETIME_TEST_IDS,
} from "../fields/denali-datetime-field";
import { DenaliDestinationCatalogMetricField } from "../fields/denali-destination-catalog-metric-field";
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
  readonly wizardRuleEvalContext?: Pick<DenaliWizardRuleEvalContext, "ruleSet">;
  readonly invalid?: boolean;
  readonly validationIssuePaths?: readonly string[];
};

type DenaliCompositeRenderer = (props: DenaliCompositeRendererProps) => ReactNode;

const DENALI_COMPOSITE_RENDERERS: Readonly<Record<DenaliImplementedCompositeId, DenaliCompositeRenderer>> =
  {
    "denali.tour-kind-basics": ({ draft, onDraftChange, field, invalid }) => (
      <DenaliTourKindField
        draft={draft}
        onDraftChange={onDraftChange}
        required={field.required}
        invalid={invalid}
      />
    ),
    "denali.destination": ({ field, draft, onDraftChange, invalid }) => (
      <DenaliDestinationField
        draft={draft}
        onDraftChange={onDraftChange}
        canonicalPath={field.canonicalPath}
        required={field.required}
        invalid={invalid}
      />
    ),
    "denali.destination-catalog-metric.peak-height": ({ field, draft, onDraftChange, invalid }) => (
      <DenaliDestinationCatalogMetricField
        draft={draft}
        onDraftChange={onDraftChange}
        canonicalPath={field.canonicalPath}
        required={field.required}
        invalid={invalid}
      />
    ),
    "denali.destination-catalog-metric.trail-distance": ({ field, draft, onDraftChange, invalid }) => (
      <DenaliDestinationCatalogMetricField
        draft={draft}
        onDraftChange={onDraftChange}
        canonicalPath={field.canonicalPath}
        required={field.required}
        invalid={invalid}
      />
    ),
    "denali.datetime": ({ draft, onDraftChange, field, invalid }) => (
      <DenaliDatetimeField
        draft={draft}
        onDraftChange={onDraftChange}
        canonicalPath={field.canonicalPath}
        required={field.required}
        testId={DENALI_DATETIME_TEST_IDS.start}
        invalid={invalid}
      />
    ),
    "denali.datetime-end": ({ draft, onDraftChange, field, invalid }) => (
      <DenaliDatetimeEndField
        draft={draft}
        onDraftChange={onDraftChange}
        required={field.required}
        invalid={invalid}
      />
    ),
    "denali.location-zones": ({ draft, onDraftChange, invalid }) => (
      <DenaliLocationZonesField draft={draft} onDraftChange={onDraftChange} invalid={invalid} />
    ),
    "denali.gathering-points": ({ draft, onDraftChange, invalid }) => (
      <DenaliGatheringPointsField draft={draft} onDraftChange={onDraftChange} invalid={invalid} />
    ),
    "denali.transport-mode": ({ draft, onDraftChange, field, invalid, validationIssuePaths }) => (
      <DenaliTransportModeField
        draft={draft}
        onDraftChange={onDraftChange}
        required={field.required}
        invalid={invalid}
        validationIssuePaths={validationIssuePaths}
      />
    ),
    "denali.difficulty-level": ({ draft, onDraftChange, field, invalid }) => (
      <DenaliDifficultyLevelField
        draft={draft}
        onDraftChange={onDraftChange}
        required={field.required}
        invalid={invalid}
      />
    ),
    "denali.elevation-gain": ({ draft, onDraftChange, field, invalid }) => (
      <DenaliElevationGainField
        draft={draft}
        onDraftChange={onDraftChange}
        required={field.required}
        invalid={invalid}
      />
    ),
    "denali.gear": ({ draft, onDraftChange, invalid }) => (
      <DenaliGearField draft={draft} onDraftChange={onDraftChange} invalid={invalid} />
    ),
    "denali.program-content": ({
      draft,
      onDraftChange,
      workspaceFormProfile,
      wizardRuleEvalContext,
      invalid,
      validationIssuePaths,
    }) => (
      <DenaliProgramContentField
        draft={draft}
        onDraftChange={onDraftChange}
        workspaceFormProfile={workspaceFormProfile}
        wizardRuleEvalContext={wizardRuleEvalContext}
        invalid={invalid}
        validationIssuePaths={validationIssuePaths}
      />
    ),
    "denali.peak-experience": ({ draft, onDraftChange, field, invalid }) => (
      <DenaliPeakExperienceField
        draft={draft}
        onDraftChange={onDraftChange}
        required={field.required}
        invalid={invalid}
      />
    ),
    "denali.pricing-payment": ({ draft, onDraftChange, invalid, validationIssuePaths }) => (
      <DenaliPricingPaymentField
        draft={draft}
        onDraftChange={onDraftChange}
        invalid={invalid}
        validationIssuePaths={validationIssuePaths}
      />
    ),
    "denali.pricing-participants": ({
      draft,
      onDraftChange,
      field,
      invalid,
      validationIssuePaths,
    }) => (
      <DenaliPricingParticipantsField
        draft={draft}
        onDraftChange={onDraftChange}
        required={field.required}
        invalid={invalid}
        validationIssuePaths={validationIssuePaths}
      />
    ),
    "denali.approximate-return-time": ({ draft, onDraftChange, field, invalid }) => (
      <DenaliApproximateReturnTimeField
        draft={draft}
        onDraftChange={onDraftChange}
        required={field.required}
        invalid={invalid}
      />
    ),
    "denali.leader-user-ids": ({ draft, onDraftChange, invalid }) => (
      <DenaliLeaderUserIdsField draft={draft} onDraftChange={onDraftChange} invalid={invalid} />
    ),
    "denali.social-media-link": ({ draft, onDraftChange, field, invalid }) => (
      <DenaliSocialMediaLinkField
        draft={draft}
        onDraftChange={onDraftChange}
        required={field.required}
        invalid={invalid}
      />
    ),
    "denali.guide-language-ids": ({ draft, onDraftChange, invalid }) => (
      <DenaliGuideLanguageIdsField
        draft={draft}
        onDraftChange={onDraftChange}
        invalid={invalid}
      />
    ),
    "denali.custom-services": ({ draft, onDraftChange, invalid }) => (
      <DenaliCustomServicesField draft={draft} onDraftChange={onDraftChange} invalid={invalid} />
    ),
    "denali.tour-services": ({ draft, onDraftChange, invalid }) => (
      <DenaliTourServicesField draft={draft} onDraftChange={onDraftChange} invalid={invalid} />
    ),
    "denali.photos": ({ draft, onDraftChange, field, wizardSessionId, invalid }) => (
      <DenaliPhotosField
        draft={draft}
        onDraftChange={onDraftChange}
        required={field.required}
        wizardSessionId={wizardSessionId}
        invalid={invalid}
      />
    ),
    "denali.itinerary": ({ draft, onDraftChange, field, invalid }) => (
      <DenaliItineraryField
        draft={draft}
        onDraftChange={onDraftChange}
        required={field.required}
        invalid={invalid}
      />
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
