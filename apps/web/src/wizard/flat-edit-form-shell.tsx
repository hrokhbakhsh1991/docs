"use client";

import { resolveWizardFlatEditFormSurface } from "@/wizard/wizard-flat-edit-form-registry";
import { useAppSession } from "@/providers/app-session-context";
import {
  applyWizardTemplateToRenderPlan,
  filterRenderPlanByCanonicalPaths,
} from "@/tours/wizard-template-gate-logic";

import { WizardField } from "./wizard-field";

type TourWizardDraft = { readonly data: Record<string, unknown> };

type OperatorFlatEditFormProps = {
  readonly draft: TourWizardDraft;
  readonly onDraftChange: (draft: TourWizardDraft) => void;
  readonly [key: string]: unknown;
};

/** Phase 12.4 / P2-D3.a — operator flat-edit form (shell wires platform WizardField). */
export function OperatorFlatEditForm({ draft, onDraftChange, ...props }: OperatorFlatEditFormProps) {
  const session = useAppSession();
  const surface = resolveWizardFlatEditFormSurface(session.pluginId);
  if (surface == null) {
    return null;
  }
  const FlatEditFormCore = surface.FlatEditForm;

  return (
    <FlatEditFormCore
      {...props}
      draft={draft}
      onDraftChange={onDraftChange}
      renderPlanOverlay={{
        applyTemplateToRenderPlan: applyWizardTemplateToRenderPlan,
        filterRenderPlanByCanonicalPaths,
      }}
      renderField={(fieldProps: any) => <WizardField {...fieldProps} />}
    />
  );
}
