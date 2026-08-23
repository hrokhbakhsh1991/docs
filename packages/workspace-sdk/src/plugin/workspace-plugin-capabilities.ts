import type { WorkspaceWizardHostHooks } from "./workspace-wizard-host-hooks";
import type { SettingsModuleManifest } from "../operator/settings/settings-module-manifest";
import type { RegistrationOpsManifest } from "../operator/bookings/registration-ops-manifest";

/**
 * Data-only host probe for Thin Shell Next boot proof (Phase 4s).
 * No React — shell owns rendering from title/body.
 */
export type WorkspaceHostProbeCapability = {
  readonly title: string;
  readonly body: string;
};

/**
 * Draft-shell identity + sync helpers (Thin Shell Phase 4v–4aa / 4al–4am).
 *
 * Envelope prepare/hydrate/merge stay on `wizardHost` (already resolved via
 * `resolveWizardHostCapability`). Phase 4al/4am deleted draft-shell and
 * draft-unification generated binders.
 */
export type WorkspaceDraftShellCapability = {
  readonly createTourDraftKey: string;
  readonly operatorDraftNamespace: string;
  readonly editTourDraftKey: (tourId: string) => string;
  readonly createWizardDraftSessionId: () => string;
  /** Phase 4w — detect fresh-start envelopes without binder warm lookup. */
  readonly isFreshStartEnvelope?: (envelope: unknown) => boolean;
  /**
   * Phase 4w — resolve merge function for draft unification mode.
   * Returns `undefined` when server-wins / merge disabled.
   */
  readonly resolveDraftMerge?: (
    mode: string
  ) => ((local: unknown, server: unknown) => unknown) | undefined;
  /**
   * Phase 4y — build create-wizard prefilled form from template gate state.
   * Package-owned (no shell product knowledge); gate/form shapes are opaque.
   */
  readonly buildCreatePrefilledForm?: (gate: unknown) => unknown;
  /**
   * Phase 4z — factory for draft-engine schema gate (prePush / merge).
   * Package-owned; rules and evalContext shapes are opaque to the shell.
   */
  readonly createDraftSchemaGate?: (rules: unknown, evalContext: unknown) => unknown;
  /**
   * Phase 4aa — true when draft has only template/sanitize defaults.
   * Package-owned pure check (no React); draft shape is opaque to the shell.
   */
  readonly isDraftEssentiallyEmpty?: (draft: unknown) => boolean;
  /**
   * Phase 4am — read canonical draft field (legacy path fallbacks).
   * Package-owned pure helper; draft shape is opaque to the shell.
   */
  readonly readDraftFieldValue?: (draft: Record<string, unknown>, canonicalPath: string) => unknown;
  /**
   * Phase 4am — optional tombstone shadow compare after successful push.
   * Package-owned; no-ops when mode is off.
   */
  readonly logTombstoneShadowMismatch?: (
    mode: string,
    baseline: unknown,
    local: unknown,
    server: unknown
  ) => void;
};

/**
 * Create-chrome warm capability (Thin Shell Phase 4ab).
 *
 * React hooks stay off the frozen plugin — package `ensureReady` publishes the
 * surface onto a product-blind global registry (string-keyed dynamic import).
 */
export type WorkspaceCreateChromeCapability = {
  readonly ensureReady: () => Promise<void>;
};

/**
 * Flat-edit chrome warm capability (Thin Shell Phase 4ac).
 * Same contract shape as createChrome — no React on the frozen plugin.
 */
export type WorkspaceFlatEditChromeCapability = {
  readonly ensureReady: () => Promise<void>;
};

/**
 * Create-view warm capability (Thin Shell Phase 4ad).
 * Same contract shape — no React on the frozen plugin.
 */
export type WorkspaceCreateViewCapability = {
  readonly ensureReady: () => Promise<void>;
};

/**
 * Flat-edit form warm capability (Thin Shell Phase 4ae).
 * Same contract shape — no React on the frozen plugin.
 */
export type WorkspaceFlatEditFormCapability = {
  readonly ensureReady: () => Promise<void>;
};

/**
 * Flat-edit page warm capability (Thin Shell Phase 4af).
 * Same contract shape — no React on the frozen plugin.
 */
export type WorkspaceFlatEditPageCapability = {
  readonly ensureReady: () => Promise<void>;
};

/**
 * Template-gate policy + pure overlay augment (Thin Shell Phase 4an).
 * No React — shell owns fetch/UI; package owns product overlay rules.
 */
export type WorkspaceTemplateGateCapability = {
  /** Default step id when publishing an empty wizard template. */
  readonly defaultPublishedStepId: string;
  /** Prefer template default values over draft seed on create prefill. */
  readonly preferTemplateDefaultsOnPrefill?: boolean;
  /**
   * Extend base overlays with package-specific hidden/default fields.
   * Absent ⇒ shell keeps base overlays unchanged.
   */
  readonly augmentFieldOverlays?: <
    T extends {
      readonly canonicalPath: string;
      readonly hidden?: boolean;
      readonly defaultValue?: string;
    },
  >(
    templateSteps: readonly {
      readonly enabled?: boolean;
      readonly fields: readonly T[];
    }[],
    baseOverlays: ReadonlyMap<string, T>
  ) => ReadonlyMap<string, T>;
};

/**
 * Operator UI warm capability (Thin Shell Phase 4ao).
 * Same contract shape as createChrome — no React on the frozen plugin.
 */
export type WorkspaceOperatorUiCapability = {
  readonly ensureReady: () => Promise<void>;
};

/** Wire payload for tour-action submit error tokens (Phase 4ap). */
export type WorkspaceTourActionSubmitErrorPayload = {
  readonly status: number;
  readonly code: string;
  readonly message: string;
  readonly correlationId?: string;
};

/**
 * Tour-action submit error codec (Thin Shell Phase 4ap).
 * Pure encode/decode — no React, no warm cache.
 */
export type WorkspaceTourActionSubmitCapability = {
  readonly encode: (payload: WorkspaceTourActionSubmitErrorPayload) => string;
  readonly decode: (raw: string) => WorkspaceTourActionSubmitErrorPayload | null;
};

/**
 * Labels warm capability (Thin Shell Phase 4aq).
 * Same contract shape as createChrome — no React on the frozen plugin.
 */
export type WorkspaceLabelsCapability = {
  readonly ensureReady: () => Promise<void>;
};

/**
 * Settings equipment UI warm capability (Thin Shell Phase 4ba).
 * Same contract shape — no React on the frozen plugin.
 */
export type WorkspaceSettingsEquipmentUiCapability = {
  readonly ensureReady: () => Promise<void>;
};

/**
 * Settings exposure surfaces UI warm capability (Thin Shell Phase 4bb).
 * Same contract shape — no React on the frozen plugin.
 */
export type WorkspaceSettingsExposureSurfacesUiCapability = {
  readonly ensureReady: () => Promise<void>;
};

/**
 * Phase 3 AppShell nav link (Thin Shell Phase 4bc).
 * Pure data — href + i18n label key under tours.shell.
 */
export type WorkspaceOperatorShellNavLink = {
  readonly href: string;
  readonly labelKey: string;
};

/**
 * Operator shell Phase 3 header links (Thin Shell Phase 4bc).
 * Pure data — no React.
 */
export type WorkspaceOperatorShellNavCapability = {
  readonly links: readonly WorkspaceOperatorShellNavLink[];
};

/**
 * Finance hub enablement (Thin Shell Phase 4bd).
 * Pure data — mirrors manifest `workspaceFinance.supported`.
 */
export type WorkspaceFinanceNavCapability = {
  readonly supported: true;
};

export type WorkspaceFinanceCaseMeaningCapability = {
  readonly supported: true;
};

/**
 * Finance ops panel resolve (Thin Shell Phase 4be).
 * Pure — no React. Return is `unknown` at the SDK boundary; shell casts.
 */
export type WorkspaceFinanceOpsCapability = {
  readonly resolveManifest: (theme?: unknown | null) => unknown;
};

/**
 * Booking ops panel resolve (Thin Shell Phase 4bf).
 * Pure — no React. Returns SDK registration-ops manifest.
 */
export type WorkspaceBookingOpsCapability = {
  readonly resolveManifest: (theme?: unknown | null) => RegistrationOpsManifest;
};

export type MemberPortalModuleRendererProps = {
  readonly moduleId: string;
  readonly routePath: string;
};

export type WorkspaceMemberPortalRenderersCapability = {
  readonly renderers: Readonly<Record<string, (props: MemberPortalModuleRendererProps) => unknown>>;
};

/**
 * Wizard create / extended operator chrome (Thin Shell Phase 4bg).
 * Pure data — mirrors manifest `wizardCreate.extendedChrome` (+ optional brand mark).
 */
export type WorkspaceWizardCreateCapability = {
  readonly extendedChrome: true;
  readonly customBrandFallbackMark?: string;
};

/**
 * Wizard composite/review surfaces warm capability (Thin Shell Phase 4as).
 * Same contract shape — no React on the frozen plugin.
 */
export type WorkspaceWizardSurfacesCapability = {
  readonly ensureReady: () => Promise<void>;
};

/**
 * Full wizard-template preset builder (Thin Shell Phase 4au).
 * Pure data factory — no React, no warm cache.
 * Return is `unknown` at the SDK boundary; shell casts to its payload type.
 */
export type WorkspaceTemplatePresetCapability = {
  readonly buildFullTemplatePreset: (seedLabel?: string) => unknown | Promise<unknown>;
};

/**
 * Settings hub recovery policy (Thin Shell Phase 4av).
 * Pure data — inject required module metadata when API registry drifts.
 */
export type WorkspaceSettingsHubFallbackCapability = {
  readonly requiredModuleIds: readonly string[];
  readonly fallbackModules: Readonly<
    Record<string, Pick<SettingsModuleManifest, "id" | "kind" | "route" | "ability" | "nav">>
  >;
};

/**
 * Wizard-template editor surface (Thin Shell Phase 4aw).
 * Pure helpers + metadata — no React.
 */
export type WorkspaceTemplateEditorCatalogFieldMeta = {
  readonly parentCanonicalPath: string | null;
  readonly compositeChildPaths: readonly string[];
  readonly matrixInjectedRequired: boolean;
  readonly registryDefaultRequired: boolean;
  readonly templateFrozen: boolean;
  readonly templateFrozenRequired: boolean;
  readonly contextualWatchCanonical: string | null;
  readonly isCompositeAnchor: boolean;
};

export type WorkspaceTemplateEditorCapability = {
  readonly messageNamespace: string;
  readonly photosStepId: string;
  readonly isLongDescriptionVisible: (fieldRulesOverlay: unknown) => boolean;
  readonly patchLongDescriptionVisibility: (
    fieldRulesOverlay: Record<string, unknown> | undefined,
    visible: boolean
  ) => Record<string, unknown>;
  readonly resolveCatalogFieldMeta: (
    canonicalPath: string,
    stepId: string,
    stepFieldPaths: readonly string[]
  ) => WorkspaceTemplateEditorCatalogFieldMeta | null;
  readonly resolveCompositeRendererIdForAnchor: (anchorCanonicalPath: string) => string | null;
  readonly isFrozenTemplateCanonicalPath: (canonicalPath: string) => boolean;
  readonly normalizePublishedPayloadSteps: <T extends { published?: boolean }>(payload: T) => T;
};

/**
 * Tour-list category/filter surface (Thin Shell Phase 4ax).
 * Pure data + predicates — no React.
 */
export type WorkspaceTourListCategoryFilterGroup = {
  readonly id: string;
  readonly slugs: readonly string[];
};

export type WorkspaceTourListCategoryCapability = {
  readonly tourKindValues: readonly string[];
  readonly filterGroups: readonly WorkspaceTourListCategoryFilterGroup[];
  readonly isTourKindSlug: (value: string | null) => boolean;
  readonly isTourCategoryGroup: (value: string) => boolean;
  readonly resolveTourKindDuration: (category: string | null) => "single_day" | "multi_day" | null;
};

/** Workspace-owned commercial presentation and prepayment policy. */
export type WorkspaceTourCommercialCapability = {
  readonly irrDisplayUnit?: "toman";
  readonly resolveSuggestedPrepaymentMinor?: (input: {
    readonly tourCanonicalData: unknown;
    readonly invoiceTotalMinor: string;
    readonly balanceDueMinor: string;
  }) => string | null;
};

/**
 * Destination settings surface (Thin Shell Phase 4az).
 * Pure location-type policy — no React.
 */
export type WorkspaceSettingsDestinationLocationType = "generic" | "peak" | "nature_trail";

export type WorkspaceSettingsDestinationMetadataField = "altitudeM" | "typicalTrailDistanceKm";

export type WorkspaceSettingsDestinationLocationTypeEntry = {
  readonly value: WorkspaceSettingsDestinationLocationType;
  readonly metadataFields: readonly WorkspaceSettingsDestinationMetadataField[];
  readonly settingsLabelKey: string;
};

export type WorkspaceSettingsDestinationCapability = {
  readonly locationTypes: readonly WorkspaceSettingsDestinationLocationTypeEntry[];
  readonly normalizeLocationType: (
    value: string | null | undefined
  ) => WorkspaceSettingsDestinationLocationType;
  readonly metadataFieldsForType: (
    locationType: WorkspaceSettingsDestinationLocationType
  ) => readonly WorkspaceSettingsDestinationMetadataField[];
};

/**
 * Host-facing capability bag (Thin Shell Phase 4r+).
 *
 * Shell should prefer `plugin.capabilities.*` over legacy top-level surfaces.
 * Absent capability ⇒ shell disables / no-ops that surface (fail-closed for
 * required routes lands in later phases).
 *
 * Additive — top-level `wizardHost` remains until callers migrate.
 */
export type WorkspacePluginCapabilities = {
  /** Same contract as top-level `WorkspacePlugin.wizardHost`. */
  readonly wizardHost?: WorkspaceWizardHostHooks;
  /** Phase 4s — Next boot stub (generic shell route). */
  readonly hostProbe?: WorkspaceHostProbeCapability;
  /** Phase 4v — draft identity + session id factory. */
  readonly draftShell?: WorkspaceDraftShellCapability;
  /** Phase 4ab — package-owned create-chrome warm (no React on plugin). */
  readonly createChrome?: WorkspaceCreateChromeCapability;
  /** Phase 4ac — package-owned flat-edit chrome warm (no React on plugin). */
  readonly flatEditChrome?: WorkspaceFlatEditChromeCapability;
  /** Phase 4ad — package-owned create-view warm (no React on plugin). */
  readonly createView?: WorkspaceCreateViewCapability;
  /** Phase 4ae — package-owned flat-edit form warm (no React on plugin). */
  readonly flatEditForm?: WorkspaceFlatEditFormCapability;
  /** Phase 4af — package-owned flat-edit page warm (no React on plugin). */
  readonly flatEditPage?: WorkspaceFlatEditPageCapability;
  /** Phase 4an — template-gate defaults + optional overlay augment. */
  readonly templateGate?: WorkspaceTemplateGateCapability;
  /** Phase 4ao — package-owned operator UI warm (no React on plugin). */
  readonly operatorUi?: WorkspaceOperatorUiCapability;
  /** Phase 4ap — pure tour-action submit error encode/decode. */
  readonly tourActionSubmit?: WorkspaceTourActionSubmitCapability;
  /** Phase 4aq — package-owned label resolver warm (no React on plugin). */
  readonly labels?: WorkspaceLabelsCapability;
  /** Phase 4as — package-owned composite/review surface warm (no React on plugin). */
  readonly wizardSurfaces?: WorkspaceWizardSurfacesCapability;
  /** Phase 4au — pure full-template preset builder. */
  readonly templatePreset?: WorkspaceTemplatePresetCapability;
  /** Phase 4av — settings hub required-module fallback policy. */
  readonly settingsHubFallback?: WorkspaceSettingsHubFallbackCapability;
  /** Phase 4aw — pure wizard-template editor surface. */
  readonly templateEditor?: WorkspaceTemplateEditorCapability;
  /** Phase 4ax — pure tour-list category/filter surface. */
  readonly tourListCategory?: WorkspaceTourListCategoryCapability;
  /** Optional workspace-owned tour commercial presentation/prepayment policy. */
  readonly tourCommercial?: WorkspaceTourCommercialCapability;
  /** Phase 4az — pure destination settings surface. */
  readonly settingsDestination?: WorkspaceSettingsDestinationCapability;
  /** Phase 4ba — package-owned settings equipment UI warm (no React on plugin). */
  readonly settingsEquipmentUi?: WorkspaceSettingsEquipmentUiCapability;
  /** Phase 4bb — package-owned settings exposure surfaces UI warm (no React on plugin). */
  readonly settingsExposureSurfacesUi?: WorkspaceSettingsExposureSurfacesUiCapability;
  /** Phase 4bc — pure Phase 3 AppShell nav links. */
  readonly operatorShellNav?: WorkspaceOperatorShellNavCapability;
  /** Phase 4bd — pure finance hub enablement (workspaceFinance.supported). */
  readonly financeNav?: WorkspaceFinanceNavCapability;
  readonly financeCaseMeaning?: WorkspaceFinanceCaseMeaningCapability;
  /** Phase 4be — pure finance ops panel resolve (theme-aware). */
  readonly financeOps?: WorkspaceFinanceOpsCapability;
  /** Phase 4bf — pure booking ops panel resolve (theme-aware). */
  readonly bookingOps?: WorkspaceBookingOpsCapability;
  /** Optional server-rendered custom member modules. */
  readonly memberPortalRenderers?: WorkspaceMemberPortalRenderersCapability;
  /** Phase 4bg — extended create chrome + optional brand fallback mark. */
  readonly wizardCreate?: WorkspaceWizardCreateCapability;
};

/** Plugin slice used by capability resolve helpers (avoids full contract import). */
export type WorkspacePluginCapabilityHostSlice = {
  readonly wizardHost?: WorkspaceWizardHostHooks;
  readonly capabilities?: WorkspacePluginCapabilities;
};

/**
 * Prefer `capabilities.wizardHost`; fall back to legacy top-level `wizardHost`.
 */
export function resolveWizardHostCapability(
  plugin: WorkspacePluginCapabilityHostSlice
): WorkspaceWizardHostHooks | undefined {
  return plugin.capabilities?.wizardHost ?? plugin.wizardHost;
}

/** Await `ensureReady` on the resolved wizard-host capability when present. */
export async function ensureWizardHostReady(
  plugin: WorkspacePluginCapabilityHostSlice
): Promise<void> {
  await resolveWizardHostCapability(plugin)?.ensureReady?.();
}

/** Resolve data-only host probe from the capability bag (no legacy fallback). */
export function resolveHostProbeCapability(
  plugin: Pick<WorkspacePluginCapabilityHostSlice, "capabilities">
): WorkspaceHostProbeCapability | undefined {
  return plugin.capabilities?.hostProbe;
}

/** Resolve draft-shell identity capability from the bag (no legacy fallback). */
export function resolveDraftShellCapability(
  plugin: Pick<WorkspacePluginCapabilityHostSlice, "capabilities">
): WorkspaceDraftShellCapability | undefined {
  return plugin.capabilities?.draftShell;
}

/** Resolve create-chrome warm capability from the bag (no legacy fallback). */
export function resolveCreateChromeCapability(
  plugin: Pick<WorkspacePluginCapabilityHostSlice, "capabilities">
): WorkspaceCreateChromeCapability | undefined {
  return plugin.capabilities?.createChrome;
}

/** Await create-chrome `ensureReady` when the capability is present. */
export async function ensureCreateChromeReady(
  plugin: Pick<WorkspacePluginCapabilityHostSlice, "capabilities">
): Promise<void> {
  await resolveCreateChromeCapability(plugin)?.ensureReady?.();
}

/** Resolve flat-edit chrome warm capability from the bag (no legacy fallback). */
export function resolveFlatEditChromeCapability(
  plugin: Pick<WorkspacePluginCapabilityHostSlice, "capabilities">
): WorkspaceFlatEditChromeCapability | undefined {
  return plugin.capabilities?.flatEditChrome;
}

/** Await flat-edit chrome `ensureReady` when the capability is present. */
export async function ensureFlatEditChromeReady(
  plugin: Pick<WorkspacePluginCapabilityHostSlice, "capabilities">
): Promise<void> {
  await resolveFlatEditChromeCapability(plugin)?.ensureReady?.();
}

/** Resolve create-view warm capability from the bag (no legacy fallback). */
export function resolveCreateViewCapability(
  plugin: Pick<WorkspacePluginCapabilityHostSlice, "capabilities">
): WorkspaceCreateViewCapability | undefined {
  return plugin.capabilities?.createView;
}

/** Await create-view `ensureReady` when the capability is present. */
export async function ensureCreateViewReady(
  plugin: Pick<WorkspacePluginCapabilityHostSlice, "capabilities">
): Promise<void> {
  await resolveCreateViewCapability(plugin)?.ensureReady?.();
}

/** Resolve flat-edit form warm capability from the bag (no legacy fallback). */
export function resolveFlatEditFormCapability(
  plugin: Pick<WorkspacePluginCapabilityHostSlice, "capabilities">
): WorkspaceFlatEditFormCapability | undefined {
  return plugin.capabilities?.flatEditForm;
}

/** Await flat-edit form `ensureReady` when the capability is present. */
export async function ensureFlatEditFormReady(
  plugin: Pick<WorkspacePluginCapabilityHostSlice, "capabilities">
): Promise<void> {
  await resolveFlatEditFormCapability(plugin)?.ensureReady?.();
}

/** Resolve flat-edit page warm capability from the bag (no legacy fallback). */
export function resolveFlatEditPageCapability(
  plugin: Pick<WorkspacePluginCapabilityHostSlice, "capabilities">
): WorkspaceFlatEditPageCapability | undefined {
  return plugin.capabilities?.flatEditPage;
}

/** Await flat-edit page `ensureReady` when the capability is present. */
export async function ensureFlatEditPageReady(
  plugin: Pick<WorkspacePluginCapabilityHostSlice, "capabilities">
): Promise<void> {
  await resolveFlatEditPageCapability(plugin)?.ensureReady?.();
}

/** Resolve template-gate capability from the bag (no legacy fallback). */
export function resolveTemplateGateCapability(
  plugin: Pick<WorkspacePluginCapabilityHostSlice, "capabilities">
): WorkspaceTemplateGateCapability | undefined {
  return plugin.capabilities?.templateGate;
}

/** Resolve operator-ui warm capability from the bag (no legacy fallback). */
export function resolveOperatorUiCapability(
  plugin: Pick<WorkspacePluginCapabilityHostSlice, "capabilities">
): WorkspaceOperatorUiCapability | undefined {
  return plugin.capabilities?.operatorUi;
}

/** Await operator-ui `ensureReady` when the capability is present. */
export async function ensureOperatorUiReady(
  plugin: Pick<WorkspacePluginCapabilityHostSlice, "capabilities">
): Promise<void> {
  await resolveOperatorUiCapability(plugin)?.ensureReady?.();
}

/** Resolve tour-action submit codec from the bag (no legacy fallback). */
export function resolveTourActionSubmitCapability(
  plugin: Pick<WorkspacePluginCapabilityHostSlice, "capabilities">
): WorkspaceTourActionSubmitCapability | undefined {
  return plugin.capabilities?.tourActionSubmit;
}

/** Resolve labels warm capability from the bag (no legacy fallback). */
export function resolveLabelsCapability(
  plugin: Pick<WorkspacePluginCapabilityHostSlice, "capabilities">
): WorkspaceLabelsCapability | undefined {
  return plugin.capabilities?.labels;
}

/** Await labels `ensureReady` when the capability is present. */
export async function ensureLabelsReady(
  plugin: Pick<WorkspacePluginCapabilityHostSlice, "capabilities">
): Promise<void> {
  await resolveLabelsCapability(plugin)?.ensureReady?.();
}

/** Resolve wizard-surfaces warm capability from the bag (no legacy fallback). */
export function resolveWizardSurfacesCapability(
  plugin: Pick<WorkspacePluginCapabilityHostSlice, "capabilities">
): WorkspaceWizardSurfacesCapability | undefined {
  return plugin.capabilities?.wizardSurfaces;
}

/** Await wizard-surfaces `ensureReady` when the capability is present. */
export async function ensureWizardSurfacesReady(
  plugin: Pick<WorkspacePluginCapabilityHostSlice, "capabilities">
): Promise<void> {
  await resolveWizardSurfacesCapability(plugin)?.ensureReady?.();
}

/** Resolve template-preset builder from the bag (no legacy fallback). */
export function resolveTemplatePresetCapability(
  plugin: Pick<WorkspacePluginCapabilityHostSlice, "capabilities">
): WorkspaceTemplatePresetCapability | undefined {
  return plugin.capabilities?.templatePreset;
}

/** Resolve settings-hub fallback policy from the bag (no legacy fallback). */
export function resolveSettingsHubFallbackCapability(
  plugin: Pick<WorkspacePluginCapabilityHostSlice, "capabilities">
): WorkspaceSettingsHubFallbackCapability | undefined {
  return plugin.capabilities?.settingsHubFallback;
}

/** Resolve template-editor surface from the bag (no legacy fallback). */
export function resolveTemplateEditorCapability(
  plugin: Pick<WorkspacePluginCapabilityHostSlice, "capabilities">
): WorkspaceTemplateEditorCapability | undefined {
  return plugin.capabilities?.templateEditor;
}

/** Resolve tour-list category surface from the bag (no legacy fallback). */
export function resolveTourListCategoryCapability(
  plugin: Pick<WorkspacePluginCapabilityHostSlice, "capabilities">
): WorkspaceTourListCategoryCapability | undefined {
  return plugin.capabilities?.tourListCategory;
}

/** Resolve workspace-owned tour commercial policy from the capability bag. */
export function resolveTourCommercialCapability(
  plugin: Pick<WorkspacePluginCapabilityHostSlice, "capabilities">
): WorkspaceTourCommercialCapability | undefined {
  return plugin.capabilities?.tourCommercial;
}

/** Resolve settings-destination surface from the bag (no legacy fallback). */
export function resolveSettingsDestinationCapability(
  plugin: Pick<WorkspacePluginCapabilityHostSlice, "capabilities">
): WorkspaceSettingsDestinationCapability | undefined {
  return plugin.capabilities?.settingsDestination;
}

/** Resolve settings-equipment-ui warm capability from the bag (no legacy fallback). */
export function resolveSettingsEquipmentUiCapability(
  plugin: Pick<WorkspacePluginCapabilityHostSlice, "capabilities">
): WorkspaceSettingsEquipmentUiCapability | undefined {
  return plugin.capabilities?.settingsEquipmentUi;
}

/** Await settings-equipment-ui `ensureReady` when the capability is present. */
export async function ensureSettingsEquipmentUiReady(
  plugin: Pick<WorkspacePluginCapabilityHostSlice, "capabilities">
): Promise<void> {
  await resolveSettingsEquipmentUiCapability(plugin)?.ensureReady?.();
}

/** Resolve settings-exposure-surfaces-ui warm capability from the bag (no legacy fallback). */
export function resolveSettingsExposureSurfacesUiCapability(
  plugin: Pick<WorkspacePluginCapabilityHostSlice, "capabilities">
): WorkspaceSettingsExposureSurfacesUiCapability | undefined {
  return plugin.capabilities?.settingsExposureSurfacesUi;
}

/** Await settings-exposure-surfaces-ui `ensureReady` when the capability is present. */
export async function ensureSettingsExposureSurfacesUiReady(
  plugin: Pick<WorkspacePluginCapabilityHostSlice, "capabilities">
): Promise<void> {
  await resolveSettingsExposureSurfacesUiCapability(plugin)?.ensureReady?.();
}

/** Resolve operator-shell Phase 3 nav links from the bag (no legacy fallback). */
export function resolveOperatorShellNavCapability(
  plugin: Pick<WorkspacePluginCapabilityHostSlice, "capabilities">
): WorkspaceOperatorShellNavCapability | undefined {
  return plugin.capabilities?.operatorShellNav;
}

/** Resolve finance-nav enablement from the bag (no legacy fallback). */
export function resolveFinanceNavCapability(
  plugin: Pick<WorkspacePluginCapabilityHostSlice, "capabilities">
): WorkspaceFinanceNavCapability | undefined {
  return plugin.capabilities?.financeNav;
}

export function resolveFinanceCaseMeaningCapability(
  plugin: Pick<WorkspacePluginCapabilityHostSlice, "capabilities">
): WorkspaceFinanceCaseMeaningCapability | undefined {
  return plugin.capabilities?.financeCaseMeaning;
}

/** Resolve finance-ops panel capability from the bag (no legacy fallback). */
export function resolveFinanceOpsCapability(
  plugin: Pick<WorkspacePluginCapabilityHostSlice, "capabilities">
): WorkspaceFinanceOpsCapability | undefined {
  return plugin.capabilities?.financeOps;
}

/** Resolve booking-ops panel capability from the bag (no legacy fallback). */
export function resolveBookingOpsCapability(
  plugin: Pick<WorkspacePluginCapabilityHostSlice, "capabilities">
): WorkspaceBookingOpsCapability | undefined {
  return plugin.capabilities?.bookingOps;
}

export function resolveMemberPortalRenderersCapability(
  plugin: Pick<WorkspacePluginCapabilityHostSlice, "capabilities">
): WorkspaceMemberPortalRenderersCapability | undefined {
  return plugin.capabilities?.memberPortalRenderers;
}

/** Resolve wizard-create capability from the bag (no legacy fallback). */
export function resolveWizardCreateCapability(
  plugin: Pick<WorkspacePluginCapabilityHostSlice, "capabilities">
): WorkspaceWizardCreateCapability | undefined {
  return plugin.capabilities?.wizardCreate;
}
