import type { CreateTourPayload, WorkspacePlugin } from "@app-tour/workspace-sdk";
import {
  prepareDenaliTourCreatePayload,
  submitDenaliCreateTourViaWizardHostWithCatalogLoader,
  type PrepareDenaliTourCreatePayloadOptions,
} from "../../wizard/denali-wizard-submit-payload";
import type { DenaliSubmitCatalogIds } from "../../wizard/denali-wizard-catalog-sanitize";
import type { DenaliTourWizardDraft } from "../../draft/denali-tour-wizard-draft";
import type { DenaliWizardRulesModule } from "../../wizard/denali-wizard-rules-module";
import type { DenaliWizardRuleEvalContext } from "../../wizard/denali-wizard-submit-payload";
import { loadDenaliSubmitCatalogIds } from "../adapters/submit-catalog-fetch";

export {
  prepareDenaliTourCreatePayload,
  type PrepareDenaliTourCreatePayloadOptions,
};

export type SubmitDenaliCreateTourInput = {
  readonly plugin: WorkspacePlugin;
  readonly draft: DenaliTourWizardDraft;
  readonly rules: DenaliWizardRulesModule;
  readonly evalContext: DenaliWizardRuleEvalContext;
  readonly loadCatalog?: () => Promise<DenaliSubmitCatalogIds>;
};

/** Phase 15.2 P15-W-B1d / P15-W-C1 — web catalog fetch + package wizardHost submit. */
export async function submitDenaliCreateTour(
  input: SubmitDenaliCreateTourInput
): Promise<CreateTourPayload> {
  const loadCatalog = input.loadCatalog ?? loadDenaliSubmitCatalogIds;
  return submitDenaliCreateTourViaWizardHostWithCatalogLoader({
    plugin: input.plugin,
    draft: input.draft as unknown as Record<string, unknown>,
    rulesModule: input.rules as DenaliWizardRulesModule,
    evalContext: input.evalContext,
    loadCatalog,
  });
}
