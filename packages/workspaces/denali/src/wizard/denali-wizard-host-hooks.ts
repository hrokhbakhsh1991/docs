import type { RenderStepPlan } from "@app-tour/platform-core";
import type { WorkspaceWizardHostHooks } from "@app-tour/workspace-sdk";

import { mergeDenaliWizardDraftEnvelope } from "../draft/merge-envelope";
import {
  denaliHydrateDraftEnvelope,
  denaliPrepareDraftEnvelope,
  type DenaliWizardDraftEnvelope,
  type DenaliWizardDraftMeta,
} from "../draft/denali-wizard-draft-binding";
import {
  createDenaliWizardDraftSessionId,
  isDenaliWizardDraftSessionId,
} from "../photos/wizard-draft-session-id";
import { readDenaliCanonicalBasics } from "../adapters/canonical-basics";
import { applyDenaliInvariantState } from "../normalize/invariantState";
import { resolveDenaliRuleSetFromTemplate } from "../normalize/resolveRuleModel";
import { evaluateFormFieldRule } from "../rules/evaluateFormRules";
import { DENALI_CANONICAL_TO_FORM_PATH_MAP } from "../rules/generated/denaliCanonicalPathMap.generated";
import { buildDenaliTourCreateDefaultValues } from "../schemas/denaliCore.schema";
import { DENALI_TOUR_KIND_VALUES, type DenaliTourKind } from "../types/legacy/repo-types";
import { resolveDenaliWizardDimensionsFromTourKind } from "../wizard-dimensions";
import {
  applyDenaliConditionalFieldRules,
  type DenaliWizardRuleEvalInput,
} from "./apply-contextual-render-plan";
import type { DenaliWizardRulesModule } from "./denali-wizard-rules-module";
import { getCanonicalStringFromDraft, type CanonicalWizardDraftEnvelope } from "./canonical-draft-access";
import { validateDenaliWizardDraftSyncFromHostInput, validateDenaliPublishReadinessSyncFromHostInput } from "./denali-wizard-validation";
import { resolveDenaliInitialStepIndexFromHostInput } from "./resolve-initial-step-index";
import {
  buildDenaliWizardRuleEvalContextFromHostInput,
  denaliHydrateTourEditDraftFromHostInput,
  prepareDenaliTourCreatePayloadFromHostInput,
  prepareDenaliTourPatchPayloadFromHostInput,
  sanitizeDenaliWizardDraftFromHostInput,
} from "./denali-wizard-submit-payload";
import { normalizeDenaliWizardTemplateGate } from "./normalize-denali-wizard-template-gate";

export type { DenaliWizardRulesModule } from "./denali-wizard-rules-module";

function asDraftEnvelope(draft: Readonly<Record<string, unknown>>): CanonicalWizardDraftEnvelope {
  if (draft.data != null && typeof draft.data === "object" && !Array.isArray(draft.data)) {
    return { data: draft.data as Record<string, unknown> };
  }
  return { data: draft };
}

async function loadDenaliWizardRulesModule(): Promise<DenaliWizardRulesModule> {
  return Object.freeze({
    evaluateFormFieldRule,
    applyDenaliInvariantState,
    resolveDenaliRuleSetFromTemplate,
    buildDefaultForm: buildDenaliTourCreateDefaultValues,
    readCanonicalBasics: readDenaliCanonicalBasics,
    canonicalToFormPathMap: DENALI_CANONICAL_TO_FORM_PATH_MAP,
    tourKindValues: DENALI_TOUR_KIND_VALUES,
  });
}

function resolveDenaliMatrixDimensionsFromDraft(
  draft: Readonly<Record<string, unknown>>,
  rulesModule: unknown
): Readonly<Record<string, string>> {
  const envelope = asDraftEnvelope(draft);
  const tourKind = getCanonicalStringFromDraft(envelope, "category");
  if (rulesModule != null && typeof rulesModule === "object") {
    const rules = rulesModule as Pick<DenaliWizardRulesModule, "readCanonicalBasics">;
    const basics =
      tourKind.length > 0 ? rules.readCanonicalBasics(tourKind as DenaliTourKind | undefined) : null;
    if (basics != null) {
      return { category: basics.category, duration: basics.duration };
    }
  }
  return resolveDenaliWizardDimensionsFromTourKind(tourKind as DenaliTourKind | undefined);
}

function applyContextualFieldRules(input: {
  readonly steps: unknown;
  readonly draft: Readonly<Record<string, unknown>>;
  readonly rulesModule: unknown;
  readonly evalContext: unknown;
}): unknown {
  return applyDenaliConditionalFieldRules(
    input.steps as readonly RenderStepPlan[],
    asDraftEnvelope(input.draft),
    input.rulesModule as DenaliWizardRulesModule,
    input.evalContext as DenaliWizardRuleEvalInput | undefined
  );
}

/** Phase 12.0 — Denali reference implementation of generic wizard host hooks. */
export const denaliWizardHostHooks: WorkspaceWizardHostHooks = Object.freeze({
  reviewStepId: "review",
  reviewSurfaceId: "denali",
  validationSurfaceId: "denali",
  compositeSurfaceId: "denali",
  fieldLabelSurfaceId: "denali",
  wizardMessageNamespace: "denali",
  showCompletionHeader: true,
  usesContextualFieldRules: true,
  usesStepValidation: true,
  usesReviewStep: true,
  reviewFieldCanonicalPath: "publishStatus",
  hostRootDataAttributes: Object.freeze({ "data-denali-wizard-host": "true" }),
  loadRulesModule: loadDenaliWizardRulesModule,
  resolveMatrixDimensionsFromDraft: resolveDenaliMatrixDimensionsFromDraft,
  applyContextualFieldRules,
  resolveInitialStepIndex: resolveDenaliInitialStepIndexFromHostInput,
  validateDraftSync: validateDenaliWizardDraftSyncFromHostInput,
  validatePublishReadiness: validateDenaliPublishReadinessSyncFromHostInput,
  buildRuleEvalContext: buildDenaliWizardRuleEvalContextFromHostInput,
  sanitizeWizardDraft: sanitizeDenaliWizardDraftFromHostInput,
  prepareSubmitPayload: prepareDenaliTourCreatePayloadFromHostInput,
  hydrateEditDraft: denaliHydrateTourEditDraftFromHostInput,
  prepareTourPatchPayload: prepareDenaliTourPatchPayloadFromHostInput,
  media: Object.freeze({
    createAssetSessionId: createDenaliWizardDraftSessionId,
    isAssetSessionId: isDenaliWizardDraftSessionId,
    mediaRouteKey: "wizard-photos",
  }),
  prepareDraftEnvelope: (form, meta) =>
    denaliPrepareDraftEnvelope(form, meta as DenaliWizardDraftMeta),
  hydrateDraftEnvelope: ({ remote, fallbackForm, fallbackMeta }) =>
    denaliHydrateDraftEnvelope(
      remote as DenaliWizardDraftEnvelope<typeof fallbackForm> | null | undefined,
      fallbackForm,
      fallbackMeta as Partial<DenaliWizardDraftMeta> | undefined
    ),
  normalizeRemoteEnvelope: (envelope) =>
    denaliHydrateDraftEnvelope(
      envelope as DenaliWizardDraftEnvelope<typeof envelope.form>,
      envelope.form,
      envelope.meta as DenaliWizardDraftMeta
    ),
  mergeDraftEnvelope: (local, server) => mergeDenaliWizardDraftEnvelope(local, server),
  normalizeWizardTemplateGate: normalizeDenaliWizardTemplateGate,
});

export { loadDenaliWizardRulesModule, resolveDenaliMatrixDimensionsFromDraft, applyContextualFieldRules };
