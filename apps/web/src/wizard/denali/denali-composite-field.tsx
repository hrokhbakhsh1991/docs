"use client";

import type { RenderFieldPlan } from "@app-tour/platform-core";
import type { ReactNode } from "react";

import type { TourWizardDraft } from "@/tours/tour-wizard-draft";

import { resolveDenaliCompositeRenderer } from "./denali-composite-renderers";

type DenaliCompositeFieldProps = {
  readonly compositeId: string;
  readonly field: RenderFieldPlan;
  readonly draft: TourWizardDraft;
  readonly onDraftChange: (draft: TourWizardDraft) => void;
  readonly wizardSessionId?: string;
  readonly workspaceFormProfile?: string;
};

export function DenaliCompositeField({
  compositeId,
  field,
  draft,
  onDraftChange,
  wizardSessionId,
  workspaceFormProfile,
}: DenaliCompositeFieldProps): ReactNode {
  const renderer = resolveDenaliCompositeRenderer(compositeId);
  if (!renderer) {
    return null;
  }
  return renderer({ field, draft, onDraftChange, wizardSessionId, workspaceFormProfile });
}
