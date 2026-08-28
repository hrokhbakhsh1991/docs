import type { WorkspacePlugin } from "@app-tour/workspace-sdk";

import {
  denaliPrepareDraftEnvelope,
  type DenaliWizardDraftEnvelope,
  type DenaliWizardDraftMeta,
} from "../../draft/denali-wizard-draft-binding";
import {
  type DenaliTourWizardDraft,
  getCanonicalStringValue,
} from "../../draft/denali-tour-wizard-draft";
import { seedEmptyVisibleDestinationCatalogMetrics } from "../../settings/apply-destination-catalog-prefill";
import type { DenaliWizardRulesModule } from "../../wizard/rules-loader";
import type { DenaliWizardRulesModule as StrictDenaliWizardRulesModule } from "../../wizard/denali-wizard-rules-module";
import type { DenaliWizardRuleEvalContext } from "../../wizard/denali-wizard-submit-payload";
import { isDraftEssentiallyEmpty } from "../../wizard/resolve-initial-step-index";
import type { DestinationResource } from "../adapters/catalog-types";
import { sanitizeDenaliWizardDraft } from "./draft-form-adapter";
import { rebaseDraftChangeOntoLatest } from "../logic/denali-tour-kind-field-logic";

export type DenaliWizardDraftPersistInput = {
  readonly getEnvelope: () => DenaliWizardDraftEnvelope<DenaliTourWizardDraft> | null;
  readonly setEnvelope: (envelope: DenaliWizardDraftEnvelope<DenaliTourWizardDraft>) => void;
  readonly denaliRules: DenaliWizardRulesModule | null;
  readonly denaliPlugin: WorkspacePlugin | null;
  readonly wizardRuleEvalContext: DenaliWizardRuleEvalContext | undefined;
  /** ED-CAT-SEED-01 — optional; omitted in unit tests that do not load destinations. */
  readonly lookupDestination?: (destinationId: string) => DestinationResource | undefined;
};

function seedVisibleCatalogMetricsAfterSanitize(
  draft: DenaliTourWizardDraft,
  lookupDestination: DenaliWizardDraftPersistInput["lookupDestination"]
): DenaliTourWizardDraft {
  if (lookupDestination == null) {
    return draft;
  }
  const destinationId = getCanonicalStringValue(draft, "destinationId").trim();
  if (destinationId.length === 0) {
    return draft;
  }
  return seedEmptyVisibleDestinationCatalogMetrics(draft, lookupDestination(destinationId));
}

function prepareDenaliWizardDraftEnvelope(
  plugin: WorkspacePlugin | null,
  form: DenaliTourWizardDraft,
  meta: DenaliWizardDraftMeta
): DenaliWizardDraftEnvelope<DenaliTourWizardDraft> {
  const prepare = plugin?.wizardHost?.prepareDraftEnvelope;
  if (prepare != null) {
    return prepare(form, meta) as DenaliWizardDraftEnvelope<DenaliTourWizardDraft>;
  }
  return denaliPrepareDraftEnvelope(form, meta);
}

function resolvePersistMeta(
  form: DenaliTourWizardDraft,
  meta: DenaliWizardDraftMeta
): DenaliWizardDraftMeta {
  if (
    meta.freshStart !== true ||
    isDraftEssentiallyEmpty(form as unknown as Record<string, unknown>)
  ) {
    return { ...meta };
  }
  const next = { ...meta };
  delete next.freshStart;
  return next;
}

/** Rebase → sanitize → dedup → persist Denali wizard draft envelope (create + flat edit). */
export function persistDenaliWizardDraftChange(
  next: DenaliTourWizardDraft,
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
        }) as DenaliTourWizardDraft)
      : input.denaliRules != null && input.wizardRuleEvalContext !== undefined
        ? sanitizeDenaliWizardDraft(
            rebased,
            input.denaliRules as unknown as StrictDenaliWizardRulesModule,
            input.wizardRuleEvalContext
          )
        : rebased;

  const seeded = seedVisibleCatalogMetricsAfterSanitize(sanitized, input.lookupDestination);

  if (envelope === null) {
    return;
  }

  const prepared = prepareDenaliWizardDraftEnvelope(
    input.denaliPlugin,
    seeded,
    resolvePersistMeta(seeded, envelope.meta)
  );
  if (
    JSON.stringify(prepared.form) === JSON.stringify(envelope.form) &&
    prepared.meta.currentStepIndex === envelope.meta.currentStepIndex &&
    prepared.meta.freshStart === envelope.meta.freshStart
  ) {
    return;
  }

  input.setEnvelope(prepared);
}
