import type { WorkspacePlugin } from "@app-tour/workspace-sdk";
import { denaliPrepareDraftEnvelope } from "@app-tour/workspace-denali/draft";

import type { DenaliWizardRulesModule } from "@/bootstrap/denali-wizard-rules";
import type { NewTourWizardDraftEnvelope } from "@/draft/denali-wizard-draft-merge";
import type { TourWizardDraft } from "@/tours/tour-wizard-draft";
import { sanitizeDenaliWizardDraft } from "@/wizard/denali/denali-draft-form-adapter";
import { rebaseDraftChangeOntoLatest } from "@/wizard/denali/denali-tour-kind-field-logic";
import type { DenaliWizardRuleEvalContext } from "@/wizard/denali/denali-wizard-ui-context";

export type DenaliWizardDraftPersistInput = {
  readonly getEnvelope: () => NewTourWizardDraftEnvelope | null;
  readonly setEnvelope: (envelope: NewTourWizardDraftEnvelope) => void;
  readonly denaliRules: DenaliWizardRulesModule | null;
  readonly denaliPlugin: WorkspacePlugin | null;
  readonly wizardRuleEvalContext: DenaliWizardRuleEvalContext | undefined;
};

/** Rebase → sanitize → dedup → persist Denali wizard draft envelope (create + flat edit). */
export function persistDenaliWizardDraftChange(
  next: TourWizardDraft,
  input: DenaliWizardDraftPersistInput
): void {
  const envelope = input.getEnvelope();
  const latestForm = envelope?.form;
  const rebased =
    latestForm != null ? rebaseDraftChangeOntoLatest(latestForm, next) : next;

  const sanitized =
    input.denaliRules != null && input.denaliPlugin?.wizardHost?.sanitizeWizardDraft != null
      ? (input.denaliPlugin.wizardHost.sanitizeWizardDraft({
          draft: rebased as unknown as Record<string, unknown>,
          rulesModule: input.denaliRules,
          evalContext: input.wizardRuleEvalContext,
        }) as TourWizardDraft)
      : input.denaliRules != null && input.wizardRuleEvalContext !== undefined
        ? sanitizeDenaliWizardDraft(rebased, input.denaliRules, input.wizardRuleEvalContext)
        : rebased;

  if (envelope === null) {
    return;
  }

  const prepared = denaliPrepareDraftEnvelope(sanitized, { ...envelope.meta });
  if (
    JSON.stringify(prepared.form) === JSON.stringify(envelope.form) &&
    prepared.meta.currentStepIndex === envelope.meta.currentStepIndex &&
    prepared.meta.freshStart === envelope.meta.freshStart
  ) {
    return;
  }

  input.setEnvelope(prepared);
}
