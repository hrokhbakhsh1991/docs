"use client";

import React, { type ReactNode } from "react";

import type { RenderFieldPlan } from "@app-tour/platform-core";

import type { TourWizardDraft } from "@/tours/tour-wizard-draft";

import { resolvePlatformCompositeRenderer } from "./platform-composite-renderers";

type PlatformCompositeFieldProps = {
  readonly compositeId: string;
  readonly field: RenderFieldPlan;
  readonly draft: TourWizardDraft;
  readonly onDraftChange: (draft: TourWizardDraft) => void;
  readonly wizardSessionId?: string;
  readonly workspaceFormProfile?: string;
  readonly wizardRuleEvalContext?: unknown;
};

export function PlatformCompositeField({
  compositeId,
  field,
  draft,
  onDraftChange,
  wizardSessionId,
  workspaceFormProfile,
  wizardRuleEvalContext,
}: PlatformCompositeFieldProps): ReactNode {
  const renderer = resolvePlatformCompositeRenderer(compositeId);
  return renderer({
    compositeId,
    field,
    draft,
    onDraftChange,
    wizardSessionId,
    workspaceFormProfile,
    wizardRuleEvalContext,
  });
}

