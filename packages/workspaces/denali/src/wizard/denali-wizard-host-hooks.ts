import type { ValidationResult } from "@app-tour/platform-core";
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
import { filterDenaliCanonicalValidationResult } from "./denali-wizard-validation";
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
import { resolveDenaliValidationStepId } from "./build-field-step-resolver";
import {
  buildDenaliWizardRuleEvalContextFromHostInput,
  denaliHydrateTourEditDraftFromHostInput,
  prepareDenaliTourCreatePayloadFromHostInput,
  prepareDenaliTourPatchPayloadFromHostInput,
  sanitizeDenaliWizardDraftFromHostInput,
} from "./denali-wizard-submit-payload";
import { applyLockedDestinationCatalogMetricsToCanonical } from "../settings/apply-locked-destination-catalog-metrics";
import { normalizeDenaliWizardTemplateGate } from "./normalize-denali-wizard-template-gate";
import { ensureWizardHostAdapterSurface } from "./host-adapter-surface";
import { ensureWizardCreateChromePackageSurface } from "./create-chrome-surface";
import { ensureWizardCreateViewPackageSurface } from "./create-view-surface";
import { ensureOperatorUiComponentsPackageSurface } from "./operator-ui-surface";
import { ensureWizardLabelResolverPackageSurface } from "./label-resolver-surface";
import { ensureWizardCompositePackageSurface } from "./wizard-surfaces-surface";

export type { DenaliWizardRulesModule } from "./denali-wizard-rules-module";

/**
 * Create + shared warm only (host-adapter, create chrome/view, operator UI, labels, composite).
 * Flat-edit chrome/form/page stay on `capabilities.flatEdit*.ensureReady` — owned by the
 * flat-edit page client so `/tours/new` does not pay for edit-only UI chunks.
 * Review surface stays cold until the review step awaits `ensureGeneratedReviewSurface`.
 * @see docs/dev/wizard-create-warm-ownership.mdoc
 */
async function ensureDenaliWizardHostReady(): Promise<void> {
  await Promise.all([
    ensureWizardHostAdapterSurface(),
    ensureWizardCreateChromePackageSurface(),
    ensureWizardCreateViewPackageSurface(),
    ensureOperatorUiComponentsPackageSurface(),
    ensureWizardLabelResolverPackageSurface(),
    ensureWizardCompositePackageSurface(),
  ]);
}

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
export const denaliWizardHostHooks = Object.freeze({
  ensureReady: async () => {
    await ensureDenaliWizardHostReady();
  },
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
  hostRootDataAttributes: Object.freeze({ "data-operator-wizard-host": "true" }),
  loadRulesModule: loadDenaliWizardRulesModule,
  resolveMatrixDimensionsFromDraft: resolveDenaliMatrixDimensionsFromDraft,
  applyContextualFieldRules,
  resolveInitialStepIndex: resolveDenaliInitialStepIndexFromHostInput,
  resolveValidationStepId: resolveDenaliValidationStepId,
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
  prepareDraftEnvelope: (form: unknown, meta: unknown) =>
    denaliPrepareDraftEnvelope(form, meta as DenaliWizardDraftMeta),
  hydrateDraftEnvelope: ({
    remote,
    fallbackForm,
    fallbackMeta,
  }: {
    readonly remote: unknown;
    readonly fallbackForm: unknown;
    readonly fallbackMeta: unknown;
  }) =>
    denaliHydrateDraftEnvelope(
      remote as DenaliWizardDraftEnvelope<typeof fallbackForm> | null | undefined,
      fallbackForm,
      fallbackMeta as Partial<DenaliWizardDraftMeta> | undefined
    ),
  normalizeRemoteEnvelope: (envelope: {
    readonly form: unknown;
    readonly meta: unknown;
  }) =>
    denaliHydrateDraftEnvelope(
      envelope as DenaliWizardDraftEnvelope<typeof envelope.form>,
      envelope.form,
      envelope.meta as DenaliWizardDraftMeta
    ),
  mergeDraftEnvelope: (local: unknown, server: unknown) =>
    mergeDenaliWizardDraftEnvelope(
      local as Parameters<typeof mergeDenaliWizardDraftEnvelope>[0],
      server as Parameters<typeof mergeDenaliWizardDraftEnvelope>[1]
    ),
  normalizeWizardTemplateGate: normalizeDenaliWizardTemplateGate,
  filterEngineValidationResult: (
    result: {
      readonly ok: boolean;
      readonly violations: readonly { readonly code?: string; readonly message: string }[];
    },
    data: Readonly<Record<string, unknown>>
  ) => filterDenaliCanonicalValidationResult(result as ValidationResult, data),
  normalizeCanonicalForPersist: (input: {
    readonly data: Readonly<Record<string, unknown>>;
    readonly destinations?: readonly Readonly<Record<string, unknown>>[];
  }) => applyLockedDestinationCatalogMetricsToCanonical(input.data, input.destinations),
} as WorkspaceWizardHostHooks);

export { loadDenaliWizardRulesModule, resolveDenaliMatrixDimensionsFromDraft, applyContextualFieldRules };
