/**
 * Pure exposure field-selection logic (Phase 5).
 *
 * Integration-agnostic: no React, no integration API, no provider credentials. The generic
 * exposure UI and the integration panel both route selection decisions through these helpers
 * so ownership of field selection lives in the exposure layer.
 *
 * @see docs/architecture/field-exposure-system.md#phase-5--generic-exposure-ui
 */

export const EXPOSURE_EXTERNAL_CHANNEL_AUDIENCE = "external_channel" as const;

export const EXPOSURE_AUDIENCE_OPTIONS = [EXPOSURE_EXTERNAL_CHANNEL_AUDIENCE] as const;

export type ExposureChecklistContext = {
  readonly surface: string;
  readonly audience: string;
  readonly trigger: string;
};

export type ExposureStoredEffectiveContext = {
  readonly storedContext: ExposureChecklistContext | null;
  readonly effectiveContext: ExposureChecklistContext;
  readonly storedDiffersFromEffective: boolean;
  readonly coordinateControlsRuntimeEffective: boolean;
};

export function exposureContextsDiffer(
  stored: ExposureChecklistContext | null,
  effective: ExposureChecklistContext,
): boolean {
  if (stored === null) {
    return false;
  }
  return (
    stored.surface !== effective.surface ||
    stored.audience !== effective.audience ||
    stored.trigger !== effective.trigger
  );
}

/**
 * Derives the exposure context from the connection provider + domain event.
 * `surface` mirrors the provider id (e.g. `telegram`); it is never hardcoded in the component.
 */
export function resolveExposureChecklistContext(
  provider: string | null | undefined,
  eventType: string,
): ExposureChecklistContext {
  const surface = provider != null && provider.trim().length > 0 ? provider.trim() : "unknown";
  return {
    surface,
    audience: EXPOSURE_EXTERNAL_CHANNEL_AUDIENCE,
    trigger: eventType,
  };
}

export type ExposureFieldSelectionState = {
  /** When true, {@link selectedFieldIds} is an explicit override; otherwise inherit defaults. */
  readonly customizeFields: boolean;
  readonly selectedFieldIds: readonly string[];
};

/** Catalog field shape accepted at the exposure UI boundary (integration-agnostic). */
export type ExposureCatalogField = {
  readonly id: string;
  readonly canonicalPath: string;
  readonly adminLabel?: string;
  readonly adminDescription?: string;
  readonly group?: string;
  readonly icon?: string;
};

export function toExposureChecklistFields(
  fields: readonly ExposureCatalogField[],
): readonly ExposureCatalogField[] {
  return fields.map((field) => ({
    id: field.id,
    canonicalPath: field.canonicalPath,
    ...(field.adminLabel == null ? {} : { adminLabel: field.adminLabel }),
    ...(field.adminDescription == null ? {} : { adminDescription: field.adminDescription }),
    ...(field.group == null ? {} : { group: field.group }),
    ...(field.icon == null ? {} : { icon: field.icon }),
  }));
}

export function catalogFieldIdsFromExposureFields(
  fields: readonly ExposureCatalogField[],
): readonly string[] {
  return fields.map((field) => field.id);
}

/**
 * Hydrates selection state from a persisted integration delivery intent row.
 * Integration panel uses this at the boundary so override semantics stay exposure-owned.
 */
export function resolveExposureFieldSelectionFromPersisted(
  customizeEnabled: boolean,
  persistedSelectedFieldIds: readonly string[],
): ExposureFieldSelectionState {
  return {
    customizeFields: customizeEnabled,
    selectedFieldIds: customizeEnabled ? [...persistedSelectedFieldIds] : [],
  };
}

/**
 * Inherit mode returns the full catalog (profile-seeded defaults); override returns the subset.
 */
export function resolveEffectiveSelectedFieldIds(
  state: ExposureFieldSelectionState,
  catalogFieldIds: readonly string[],
): readonly string[] {
  return state.customizeFields ? state.selectedFieldIds : catalogFieldIds;
}

/**
 * Toggling any field implies override mode; the new selection is derived from the current
 * effective selection so inherit → override does not silently drop defaults.
 */
export function toggleExposureFieldSelection(
  state: ExposureFieldSelectionState,
  catalogFieldIds: readonly string[],
  fieldId: string,
  checked: boolean,
): ExposureFieldSelectionState {
  const baseline = resolveEffectiveSelectedFieldIds(state, catalogFieldIds);
  const nextSelected = checked
    ? [...new Set([...baseline, fieldId])]
    : baseline.filter((id) => id !== fieldId);
  return { customizeFields: true, selectedFieldIds: nextSelected };
}

/**
 * Explicit inherit/override switch. Entering override seeds the current effective selection;
 * returning to inherit drops the stored override entirely.
 */
export function setExposureCustomizeFields(
  state: ExposureFieldSelectionState,
  catalogFieldIds: readonly string[],
  customize: boolean,
): ExposureFieldSelectionState {
  if (customize) {
    return {
      customizeFields: true,
      selectedFieldIds: [...resolveEffectiveSelectedFieldIds(state, catalogFieldIds)],
    };
  }
  return { customizeFields: false, selectedFieldIds: [] };
}

/** Maps catalog fields to the caller's selected-id order (unknown ids skipped). */
export function resolveExposureCatalogFieldsInSelectedOrder(
  fields: readonly ExposureCatalogField[],
  selectedFieldIds: readonly string[],
): readonly ExposureCatalogField[] {
  const byId = new Map(fields.map((field) => [field.id, field] as const));
  const ordered: ExposureCatalogField[] = [];
  for (const fieldId of selectedFieldIds) {
    const field = byId.get(fieldId);
    if (field !== undefined) {
      ordered.push(field);
    }
  }
  return ordered;
}

export type ExposureFieldDecoration = {
  readonly prefix: string;
};

export type ExposureFieldDecorations = Readonly<Record<string, ExposureFieldDecoration>>;

export type ExposureSelectionSaveInput = {
  readonly enabled: boolean;
  readonly selectedFieldIds: readonly string[];
};

export type ExposureIntentPatchInput = ExposureSelectionSaveInput & {
  readonly surface: string;
  readonly audience: string;
  readonly trigger: string;
  readonly templateId: string | null;
  readonly fieldDecorations?: ExposureFieldDecorations | null;
};

export type PersistedExposureIntentContext = {
  readonly surface?: string;
  readonly audience?: string;
  readonly trigger?: string;
  readonly eventType?: string;
  readonly routeScoped?: boolean;
};

export function isRouteScopedExposureIntent(
  persistedIntent?: PersistedExposureIntentContext | null,
): boolean {
  return persistedIntent?.routeScoped === true;
}

/**
 * Hydrates exposure context dimensions from a persisted intent row, falling back to the
 * connection provider and panel event type when legacy rows omit explicit dimensions.
 */
export function resolveExposureIntentContextFromPersisted(
  provider: string,
  panelEventType: string,
  persistedIntent?: PersistedExposureIntentContext | null,
): ExposureChecklistContext {
  const surface =
    persistedIntent?.surface != null && persistedIntent.surface.trim().length > 0
      ? persistedIntent.surface.trim()
      : provider.trim().length > 0
        ? provider.trim()
        : "unknown";
  const audience =
    persistedIntent?.audience != null && persistedIntent.audience.trim().length > 0
      ? persistedIntent.audience.trim()
      : EXPOSURE_EXTERNAL_CHANNEL_AUDIENCE;
  const trigger =
    persistedIntent?.trigger != null && persistedIntent.trigger.trim().length > 0
      ? persistedIntent.trigger.trim()
      : persistedIntent?.eventType != null && persistedIntent.eventType.trim().length > 0
        ? persistedIntent.eventType.trim()
        : panelEventType;

  return { surface, audience, trigger };
}

/** Effective coordinate used by dispatch/policy lookup today (provider + routed event). */
export function resolveEffectiveExposureContextForDispatch(
  provider: string | null | undefined,
  eventType: string,
): ExposureChecklistContext {
  return resolveExposureChecklistContext(provider, eventType);
}

export type StoredVsEffectiveExposureContext = {
  readonly stored: ExposureChecklistContext;
  readonly effective: ExposureChecklistContext;
  readonly storedDiffersFromEffective: boolean;
  /** Route-scoped stored coordinate dimensions become runtime-authoritative after save. */
  readonly coordinateControlsRuntimeEffective: boolean;
};

export function resolveStoredVsEffectiveExposureContext(input: {
  readonly provider: string;
  readonly panelEventType: string;
  readonly draftContext?: ExposureChecklistContext;
  readonly persistedIntent?: PersistedExposureIntentContext | null;
}): StoredVsEffectiveExposureContext {
  const stored =
    input.draftContext ??
    resolveExposureIntentContextFromPersisted(
      input.provider,
      input.panelEventType,
      input.persistedIntent,
    );
  const defaultEffective = resolveEffectiveExposureContextForDispatch(
    input.provider,
    input.panelEventType,
  );
  const persistedStored = resolveExposureIntentContextFromPersisted(
    input.provider,
    input.panelEventType,
    input.persistedIntent,
  );
  const routeScoped = isRouteScopedExposureIntent(input.persistedIntent);
  const effective = routeScoped ? persistedStored : defaultEffective;
  const storedDiffersFromEffective = exposureContextsDiffer(stored, effective);

  return {
    stored,
    effective,
    storedDiffersFromEffective,
    coordinateControlsRuntimeEffective: routeScoped,
  };
}

export function exposureContextsEqual(
  left: ExposureChecklistContext,
  right: ExposureChecklistContext,
): boolean {
  return (
    left.surface === right.surface &&
    left.audience === right.audience &&
    left.trigger === right.trigger
  );
}

/**
 * Maps panel state into the native exposure-intent PATCH body (full context + field override).
 * Legacy `fieldDecorations` are always cleared — emoji/ordering live in the template canvas.
 */
export function resolveExposureIntentPatchInput(input: {
  readonly selection: ExposureFieldSelectionState;
  readonly context: ExposureChecklistContext;
  readonly template: string;
}): ExposureIntentPatchInput {
  const selectionSaveInput = resolveExposureSelectionSaveInput(input.selection);
  const trimmedTemplate = input.template.trim();
  return {
    enabled: selectionSaveInput.enabled,
    selectedFieldIds: [...selectionSaveInput.selectedFieldIds],
    surface: input.context.surface,
    audience: input.context.audience,
    trigger: input.context.trigger,
    templateId: trimmedTemplate.length === 0 ? null : trimmedTemplate,
    fieldDecorations: null,
  };
}

/**
 * Maps the inherit/override state into the integration delivery-intent save shape.
 * Inherit persists no field override (empty list + disabled).
 */
export function resolveExposureSelectionSaveInput(
  state: ExposureFieldSelectionState,
): ExposureSelectionSaveInput {
  return {
    enabled: state.customizeFields,
    selectedFieldIds: state.customizeFields ? [...state.selectedFieldIds] : [],
  };
}
