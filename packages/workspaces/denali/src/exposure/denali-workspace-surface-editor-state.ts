/**
 * Operator surfaces panel editor state derived from a persisted surface intent.
 * Independent of host React / BFF client types.
 */
export const DENALI_WORKSPACE_SURFACES_TEST_IDS = {
  panel: "denali-workspace-surfaces-panel",
  surface: "denali-workspace-surface",
} as const;

export type DenaliWorkspaceSurfaceEditorState = {
  readonly customizeFields: boolean;
  readonly selectedFieldIds: readonly string[];
  readonly audience: string;
  readonly trigger: string;
};

export type DenaliWorkspaceSurfaceIntentInput = {
  readonly mode?: string;
  readonly selectedFieldIds?: readonly string[] | null;
};

/** PATCH body for `patchWorkspaceSurfaceExposureIntent` (host BFF client). */
export type DenaliWorkspaceSurfacePatchInput = {
  readonly audience: string;
  readonly trigger: string;
  readonly enabled: boolean;
  readonly selectedFieldIds: readonly string[];
};

/**
 * Maps surface coordinate + persisted intent → checklist editor state
 * (`override_fields` enables customize; otherwise selection is empty / inherit).
 */
export function buildDenaliWorkspaceSurfaceEditorState(input: {
  readonly audience: string;
  readonly trigger: string;
  readonly activeIntent: DenaliWorkspaceSurfaceIntentInput | null | undefined;
}): DenaliWorkspaceSurfaceEditorState {
  const customizeFields = input.activeIntent?.mode === "override_fields";
  const persistedIds = input.activeIntent?.selectedFieldIds ?? [];
  return {
    customizeFields,
    selectedFieldIds: customizeFields ? [...persistedIds] : [],
    audience: input.audience,
    trigger: input.trigger,
  };
}

/**
 * Maps checklist editor state → PATCH body for workspace surface exposure intent.
 * When inherit/customize is off, selectedFieldIds is always empty.
 */
export function buildDenaliWorkspaceSurfacePatchInput(
  state: DenaliWorkspaceSurfaceEditorState
): DenaliWorkspaceSurfacePatchInput {
  return {
    audience: state.audience,
    trigger: state.trigger,
    enabled: state.customizeFields,
    selectedFieldIds: state.customizeFields ? [...state.selectedFieldIds] : [],
  };
}

/** Minimal surface row needed to seed panel editor state (host BFF-agnostic). */
export type DenaliWorkspaceSurfaceEditorSource = {
  readonly surface: string;
  readonly audience: string;
  readonly trigger: string;
  readonly activeIntent: DenaliWorkspaceSurfaceIntentInput | null | undefined;
};

/**
 * Maps a surfaces list → keyed editor state record for the operator panel checklist.
 */
export function buildDenaliWorkspaceSurfaceEditorStatesMap(
  surfaces: readonly DenaliWorkspaceSurfaceEditorSource[]
): Readonly<Record<string, DenaliWorkspaceSurfaceEditorState>> {
  const next: Record<string, DenaliWorkspaceSurfaceEditorState> = {};
  for (const surface of surfaces) {
    next[surface.surface] = buildDenaliWorkspaceSurfaceEditorState({
      audience: surface.audience,
      trigger: surface.trigger,
      activeIntent: surface.activeIntent,
    });
  }
  return next;
}

/** Selection fields updated by the operator checklist (audience/trigger preserved). */
export type DenaliWorkspaceSurfaceEditorSelectionPatch = {
  readonly customizeFields: boolean;
  readonly selectedFieldIds: readonly string[];
};

/**
 * Merges a checklist selection patch onto the current editor row (or fallback).
 * Preserves audience/trigger from the base state.
 */
export function mergeDenaliWorkspaceSurfaceEditorState(
  current: DenaliWorkspaceSurfaceEditorState | undefined,
  fallback: DenaliWorkspaceSurfaceEditorState,
  patch: DenaliWorkspaceSurfaceEditorSelectionPatch
): DenaliWorkspaceSurfaceEditorState {
  const base = current ?? fallback;
  return {
    audience: base.audience,
    trigger: base.trigger,
    customizeFields: patch.customizeFields,
    selectedFieldIds: [...patch.selectedFieldIds],
  };
}

/**
 * Immutable update of one surface key inside the panel editor-state map.
 */
export function patchDenaliWorkspaceSurfaceEditorStatesMap(
  current: Readonly<Record<string, DenaliWorkspaceSurfaceEditorState>>,
  surfaceKey: string,
  fallback: DenaliWorkspaceSurfaceEditorState,
  patch: DenaliWorkspaceSurfaceEditorSelectionPatch
): Record<string, DenaliWorkspaceSurfaceEditorState> {
  return {
    ...current,
    [surfaceKey]: mergeDenaliWorkspaceSurfaceEditorState(current[surfaceKey], fallback, patch),
  };
}

export type DenaliOperatorSurfaceDisplayKind = "name" | "description";

/** next-intl-style message lookup used by the operator surfaces panel. */
export type DenaliOperatorSurfaceMessageLookup = {
  readonly has: (key: string) => boolean;
  readonly t: (key: string) => string;
};

export function denaliOperatorSurfaceMessageKey(
  kind: DenaliOperatorSurfaceDisplayKind,
  surface: string
): string {
  return kind === "name" ? `surfaceNames.${surface}` : `surfaceDescriptions.${surface}`;
}

/**
 * Resolves operator surface title/description from message catalogs.
 * Missing keys fall back to `fallback` (surface id for names; default copy for descriptions).
 */
export function resolveDenaliOperatorSurfaceDisplayText(input: {
  readonly kind: DenaliOperatorSurfaceDisplayKind;
  readonly surface: string;
  readonly messages: DenaliOperatorSurfaceMessageLookup;
  readonly fallback: string;
}): string {
  const key = denaliOperatorSurfaceMessageKey(input.kind, input.surface);
  return input.messages.has(key) ? input.messages.t(key) : input.fallback;
}
