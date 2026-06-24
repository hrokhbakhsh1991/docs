import type { WorkspaceWizardMediaHooks } from "./workspace-wizard-media-hooks";
import type {
  WorkspaceWizardDraftEnvelope,
  WorkspaceWizardDraftMeta,
} from "./workspace-wizard-draft-envelope";

/** Step-scoped or full-draft validation result (matches platform-core ValidationResult shape). */
export type WizardDraftValidationViolation = {
  readonly code: string;
  readonly fieldId?: string;
  readonly message: string;
};

export type WizardDraftValidationResult = {
  readonly ok: boolean;
  readonly violations: readonly WizardDraftValidationViolation[];
};

/** Plugin slice passed into host hooks — avoids contract ↔ hooks import cycle. */
export type WorkspaceWizardHostPluginContext = {
  readonly wizard: import("./workspace-wizard-surface").WorkspaceWizardSurface;
  readonly fieldRegistry: import("../registry/field-registry").WorkspaceFieldRegistry;
  readonly ruleSet: import("../registry/rule-set").WorkspaceRuleSet;
  readonly validation: import("./workspace-validation").WorkspaceValidationHooks;
};

/**
 * Optional workspace wizard host hooks (Phase 12.0 — DEC-P12-001).
 * Platform web host reads these from WorkspacePlugin instead of hardcoding plugin ids.
 */
export type WorkspaceWizardHostHooks = {
  /** Review/read-back step id (e.g. Denali `"review"`). Host reserves UX for this step. */
  readonly reviewStepId?: string;
  /** Show completion / quality header above the stepper. */
  readonly showCompletionHeader?: boolean;
  /** Apply contextual visibility/required after static matrix render plan. */
  readonly usesContextualFieldRules?: boolean;
  /** Block step Next until workspace step validation passes. */
  readonly usesStepValidation?: boolean;
  /**
   * Lazy workspace rules module (Denali: evaluateFormFieldRule bundle).
   * Opaque to the host — only passed back into workspace-specific adapters.
   */
  readonly loadRulesModule?: () => Promise<unknown>;
  /**
   * Resolve rule matrix dimensions from canonical draft + optional rules module.
   * Example: Denali category × duration from tour kind slug.
   */
  readonly resolveMatrixDimensionsFromDraft?: (
    draft: Readonly<Record<string, unknown>>,
    rulesModule: unknown
  ) => Readonly<Record<string, string>>;
  /** Apply contextual field visibility/required on render plan steps. */
  readonly applyContextualFieldRules?: (input: {
    readonly steps: unknown;
    readonly draft: Readonly<Record<string, unknown>>;
    readonly rulesModule: unknown;
    readonly evalContext: unknown;
  }) => unknown;
  /** Host renders workspace review/read-back chrome when active step matches reviewStepId. */
  readonly usesReviewStep?: boolean;
  /**
   * Canonical path for the review-step field lifted from the engine plan (INV-WIZ-002).
   * Denali: `"publishStatus"`. Host appends this field on the injected review step only.
   */
  readonly reviewFieldCanonicalPath?: string;
  /** Extra data-* attributes on wizard host root (workspace skin markers). */
  readonly hostRootDataAttributes?: Readonly<Record<string, string>>;
  /** Registry key for workspace-specific review/read-back React surface (Phase 12.1). */
  readonly reviewSurfaceId?: string;
  /** Registry key for step/review validation summary UI (defaults to reviewSurfaceId when unset). */
  readonly validationSurfaceId?: string;
  /** Registry key for composite field widgets (Phase 12.1b). */
  readonly compositeSurfaceId?: string;
  /** next-intl namespace for workspace wizard copy (e.g. Denali `"denali"`). */
  readonly wizardMessageNamespace?: string;
  /** Registry key for workspace field label resolver (Phase 12.1b). */
  readonly fieldLabelSurfaceId?: string;
  /** Phase 13.0 — wizard-scoped async asset upload (session id + BFF route key). */
  readonly media?: WorkspaceWizardMediaHooks;
  /** Phase 13.0b — clone form + meta into client envelope (strips server-only meta fields). */
  readonly prepareDraftEnvelope?: <TForm>(
    form: TForm,
    meta: WorkspaceWizardDraftMeta
  ) => WorkspaceWizardDraftEnvelope<TForm>;
  /** Phase 13.0b — hydrate remote envelope with fallbacks. */
  readonly hydrateDraftEnvelope?: <TForm>(input: {
    readonly remote: WorkspaceWizardDraftEnvelope<TForm> | null | undefined;
    readonly fallbackForm: TForm;
    readonly fallbackMeta?: WorkspaceWizardDraftMeta;
  }) => WorkspaceWizardDraftEnvelope<TForm>;
  /** Phase 13.0b — post-fetch sanitize (e.g. strip server tombstones from meta). */
  readonly normalizeRemoteEnvelope?: <TForm>(
    envelope: WorkspaceWizardDraftEnvelope<TForm>
  ) => WorkspaceWizardDraftEnvelope<TForm>;
  /** Phase 14.2 — merge local + server draft envelopes on sync conflict. */
  readonly mergeDraftEnvelope?: <TForm>(
    local: WorkspaceWizardDraftEnvelope<TForm>,
    server: WorkspaceWizardDraftEnvelope<TForm>
  ) => WorkspaceWizardDraftEnvelope<TForm>;
  /** Phase 14.0b — workspace-specific wizard template invariant overlay. */
  readonly normalizeWizardTemplateGate?: (
    input: import("./workspace-wizard-template-gate").WorkspaceWizardTemplateGateNormalizeInput
  ) => import("./workspace-wizard-template-gate").WorkspaceWizardTemplateGateNormalizeResult;
  /**
   * Infer initial wizard step on first mount (e.g. resume from draft data).
   * Host calls once when saved step index is 0.
   */
  readonly resolveInitialStepIndex?: (input: {
    readonly draft: Readonly<Record<string, unknown>>;
    readonly visibleSteps: readonly unknown[];
    readonly savedStepIndex: number;
    readonly skipFieldInference?: boolean;
  }) => number;
  /** Synchronous canonical validation — host uses for step Next + review summary. */
  readonly validateDraftSync?: (input: {
    readonly plugin: WorkspaceWizardHostPluginContext;
    readonly draft: Readonly<Record<string, unknown>>;
    readonly rulesModule: unknown;
    readonly tenantId: string;
    readonly evalContext?: unknown;
    readonly scope?: {
      readonly stepId?: string;
      readonly visibleSteps?: readonly unknown[];
    };
  }) => WizardDraftValidationResult;
  /** Rule-engine publish matrix — host calls before publish transition (Phase 12.6). */
  readonly validatePublishReadiness?: (input: {
    readonly plugin: WorkspaceWizardHostPluginContext;
    readonly draft: Readonly<Record<string, unknown>>;
    readonly rulesModule: unknown;
    readonly evalContext: unknown;
    readonly scope?: {
      readonly publishTransition?: boolean;
    };
  }) => WizardDraftValidationResult;
  /** Build opaque rule eval context (profile + template overlay). */
  readonly buildRuleEvalContext?: (input: {
    readonly workspaceFormProfile?: string;
    readonly mainThemeFormProfile?: string;
    readonly fieldRulesOverlay?: Readonly<Record<string, unknown>>;
  }) => unknown;
  /** Purge ghost values after invariant sanitize — host/client on draft change. */
  readonly sanitizeWizardDraft?: (input: {
    readonly draft: Readonly<Record<string, unknown>>;
    readonly rulesModule: unknown;
    readonly evalContext: unknown;
  }) => Readonly<Record<string, unknown>>;
  /** Project draft → CreateTourPayload before POST /tours. */
  readonly prepareSubmitPayload?: (input: {
    readonly plugin: WorkspaceWizardHostPluginContext;
    readonly draft: Readonly<Record<string, unknown>>;
    readonly rulesModule: unknown;
    readonly evalContext: unknown;
    readonly catalog?: {
      readonly activeEquipmentIds?: readonly string[];
      readonly activeThemeIds?: readonly string[];
      readonly activeGuideLanguageIds?: readonly string[];
      readonly activeDestinationIds?: readonly string[];
      readonly selectableLeaderIds?: readonly string[];
    };
  }) => unknown;
  /** Map stored tour canonical → wizard draft data for edit flow (Phase 12.2b). */
  readonly hydrateEditDraft?: (input: {
    readonly canonicalData: Readonly<Record<string, unknown>>;
    readonly activeEquipmentIds?: readonly string[];
    readonly activeDestinationIds?: readonly string[];
  }) => Readonly<Record<string, unknown>>;
  /** Project draft → UpdateTourPayload before PATCH /tours/{id}. */
  readonly prepareTourPatchPayload?: (input: {
    readonly plugin: WorkspaceWizardHostPluginContext;
    readonly draft: Readonly<Record<string, unknown>>;
    readonly rulesModule: unknown;
    readonly evalContext: unknown;
    readonly rowVersion: number;
    /** Phase 12.4c — save strips publish fields; publish sets active (Denali). Default save. */
    readonly patchIntent?: "save" | "publish" | "unpublish";
    readonly catalog?: {
      readonly activeEquipmentIds?: readonly string[];
      readonly activeThemeIds?: readonly string[];
      readonly activeGuideLanguageIds?: readonly string[];
      readonly activeDestinationIds?: readonly string[];
      readonly selectableLeaderIds?: readonly string[];
    };
  }) => unknown;
};
