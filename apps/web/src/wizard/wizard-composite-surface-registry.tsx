"use client";

import type { RenderFieldPlan } from "@app-tour/platform-core";
import dynamic from "next/dynamic";
import type { ReactNode } from "react";

import type { TourWizardDraft } from "@/tours/tour-wizard-draft";
import { resolveDenaliFieldLabel, resolveDenaliStepLabel } from "@/i18n/denali-wizard-labels";

const DenaliCompositeField = dynamic(
  () => import("./denali/denali-composite-field").then((mod) => mod.DenaliCompositeField),
  {
    ssr: false,
    loading: () => <p data-denali-wizard-composite-loading aria-busy="true" />,
  }
);

export type WizardCompositeFieldRenderProps = {
  readonly compositeId: string;
  readonly field: RenderFieldPlan;
  readonly draft: TourWizardDraft;
  readonly onDraftChange: (draft: TourWizardDraft) => void;
  readonly wizardSessionId?: string;
  readonly workspaceFormProfile?: string;
};

export type WizardCompositeSurface = {
  readonly renderCompositeField: (props: WizardCompositeFieldRenderProps) => ReactNode;
  readonly resolveFieldLabel: (
    translate: (key: string) => string,
    canonicalPath: string
  ) => string;
  readonly resolveStepLabel?: (
    translate: (key: string) => string,
    stepId: string
  ) => string;
};

const DENALI_COMPOSITE_SURFACE: WizardCompositeSurface = Object.freeze({
  renderCompositeField: (props) => (
    <DenaliCompositeField
      compositeId={props.compositeId}
      field={props.field}
      draft={props.draft}
      onDraftChange={props.onDraftChange}
      wizardSessionId={props.wizardSessionId}
      workspaceFormProfile={props.workspaceFormProfile}
    />
  ),
  resolveFieldLabel: (translate, canonicalPath) =>
    resolveDenaliFieldLabel(translate, canonicalPath),
  resolveStepLabel: (translate, stepId) => resolveDenaliStepLabel(translate, stepId),
});

const WIZARD_COMPOSITE_SURFACE_REGISTRY: Readonly<Record<string, WizardCompositeSurface>> =
  Object.freeze({
    denali: DENALI_COMPOSITE_SURFACE,
  });

export function resolveWizardCompositeSurface(
  surfaceId: string | undefined
): WizardCompositeSurface | null {
  if (surfaceId == null || surfaceId.trim().length === 0) {
    return null;
  }
  return WIZARD_COMPOSITE_SURFACE_REGISTRY[surfaceId] ?? null;
}
