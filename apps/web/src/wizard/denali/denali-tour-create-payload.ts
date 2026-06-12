import type { CreateTourPayload, WorkspacePlugin } from "@app-tour/workspace-sdk";
import {
  prepareDenaliTourCreatePayload as prepareDenaliTourCreatePayloadCore,
  type PrepareDenaliTourCreatePayloadOptions,
} from "@app-tour/workspace-denali/wizard/submit";

import type { DenaliWizardRulesModule } from "@/bootstrap/denali-wizard-rules";
import type { TourWizardDraft } from "@/tours/tour-wizard-draft";

import type { DenaliWizardRuleEvalContext } from "./denali-wizard-ui-context";

export type { PrepareDenaliTourCreatePayloadOptions };

/** Web adapter — accepts TourWizardDraft envelope used by operator UI. */
export function prepareDenaliTourCreatePayload(
  draft: TourWizardDraft,
  plugin: WorkspacePlugin,
  rules: DenaliWizardRulesModule,
  evalContext: DenaliWizardRuleEvalContext,
  options?: PrepareDenaliTourCreatePayloadOptions
): CreateTourPayload {
  return prepareDenaliTourCreatePayloadCore(
    draft as unknown as Record<string, unknown>,
    plugin,
    rules,
    evalContext,
    options
  );
}
