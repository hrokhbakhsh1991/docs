/**
 * Workspace exposure surface — surface defaults for the field exposure control plane.
 * Declared on {@link WorkspacePlugin.exposureSurface}; consumed by API exposure module.
 */

export type WorkspaceExposureSurfaceDefinition = {
  readonly surface: string;
  readonly audience: string;
  readonly triggerLabel: string;
  /** Persisted {@link ExposureIntent} trigger key (may differ from triggerLabel). */
  readonly triggerStorageKey: string;
  readonly defaultFieldIds: readonly string[];
  /** When false, hidden from workspace settings surfaces panel (default true). */
  readonly operatorSettingsVisible?: boolean;
};

export type WorkspaceExposureSurface = {
  readonly manifestVersion: 1;
  readonly definitions: readonly WorkspaceExposureSurfaceDefinition[];
};

function assertNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`EXPOSURE_SURFACE_INVALID:${label}`);
  }
  return value.trim();
}

function validateFieldIds(fieldIds: readonly string[], label: string): void {
  if (fieldIds.length === 0) {
    throw new Error(`EXPOSURE_SURFACE_EMPTY_FIELD_IDS:${label}`);
  }
  const seen = new Set<string>();
  for (const fieldId of fieldIds) {
    const id = assertNonEmptyString(fieldId, `${label}.fieldId`);
    if (seen.has(id)) {
      throw new Error(`EXPOSURE_SURFACE_DUPLICATE_FIELD:${label}:${id}`);
    }
    seen.add(id);
  }
}

/** Fail closed before plugin registry construction. */
export function validateExposureSurface(surface: WorkspaceExposureSurface): void {
  if (surface.manifestVersion !== 1) {
    throw new Error(`EXPOSURE_SURFACE_INVALID_MANIFEST_VERSION:${surface.manifestVersion}`);
  }

  const surfaceIds = new Set<string>();
  for (const definition of surface.definitions) {
    const surfaceId = assertNonEmptyString(definition.surface, "definition.surface");
    if (surfaceIds.has(surfaceId)) {
      throw new Error(`EXPOSURE_SURFACE_DUPLICATE_SURFACE:${surfaceId}`);
    }
    surfaceIds.add(surfaceId);

    assertNonEmptyString(definition.audience, `definition.${surfaceId}.audience`);
    assertNonEmptyString(definition.triggerLabel, `definition.${surfaceId}.triggerLabel`);
    assertNonEmptyString(definition.triggerStorageKey, `definition.${surfaceId}.triggerStorageKey`);
    validateFieldIds(definition.defaultFieldIds, `definition.${surfaceId}.defaultFieldIds`);
  }
}
