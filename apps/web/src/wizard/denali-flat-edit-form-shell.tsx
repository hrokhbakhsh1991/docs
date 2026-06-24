"use client";

import {
  DenaliFlatEditForm as DenaliFlatEditFormCore,
  DENALI_FLAT_EDIT_TEST_IDS,
  type DenaliFlatEditFormProps as DenaliFlatEditFormCoreProps,
} from "@app-tour/workspace-denali/ui/chrome/denali-flat-edit-form";

import {
  applyWizardTemplateToRenderPlan,
  filterRenderPlanByCanonicalPaths,
} from "@/tours/wizard-template-gate-logic";

import type { DenaliTourWizardDraft as TourWizardDraft } from "@app-tour/workspace-denali/draft/tour-wizard";

import { WizardField } from "./wizard-field";

export { DENALI_FLAT_EDIT_TEST_IDS };

type DenaliFlatEditFormProps = Omit<
  DenaliFlatEditFormCoreProps,
  "renderPlanOverlay" | "renderField" | "draft" | "onDraftChange"
> & {
  readonly draft: TourWizardDraft;
  readonly onDraftChange: (draft: TourWizardDraft) => void;
};

/** Phase 12.4 — Denali flat edit form (shell wires platform WizardField). */
export function DenaliFlatEditForm({ draft, onDraftChange, ...props }: DenaliFlatEditFormProps) {
  return (
    <DenaliFlatEditFormCore
      {...props}
      draft={draft}
      onDraftChange={onDraftChange}
      renderPlanOverlay={{
        applyTemplateToRenderPlan: applyWizardTemplateToRenderPlan,
        filterRenderPlanByCanonicalPaths,
      }}
      renderField={(fieldProps) => <WizardField {...fieldProps} />}
    />
  );
}
