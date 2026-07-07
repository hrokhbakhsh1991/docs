import type { WorkspaceFieldKind } from "@app-tour/workspace-sdk";

import { resolveWorkspacePluginForType } from "../workspace/resolve-workspace-plugin";

/**
 * Exposure-owned field catalog entry.
 * Sourced from {@link WorkspacePlugin.fieldRegistry} — not FieldPolicy.
 */
export type ExposureFieldCatalogEntry = {
  readonly id: string;
  readonly canonicalPath: string;
  readonly kind: WorkspaceFieldKind;
  readonly tags?: readonly string[];
  readonly adminLabel?: string;
  readonly adminDescription?: string;
  readonly group?: string;
  readonly icon?: string;
};

export const DELIVERABLE_REGISTRY_TAG = "deliverable" as const;

function resolveWorkspacePluginSafely(workspaceType: string | null) {
  if (workspaceType === null || workspaceType.trim().length === 0) {
    return null;
  }
  try {
    return resolveWorkspacePluginForType(workspaceType);
  } catch {
    return null;
  }
}

/**
 * Phase 4 exposure catalog — full workspace field registry projection.
 */
export function buildExposureFieldCatalog(
  workspaceType: string | null,
): readonly ExposureFieldCatalogEntry[] {
  const plugin = resolveWorkspacePluginSafely(workspaceType);
  if (plugin === null) {
    return [];
  }

  return plugin.fieldRegistry.fields
    .map((field) => {
      const entry: ExposureFieldCatalogEntry = {
        id: field.id,
        canonicalPath: field.canonicalPath,
        kind: field.kind,
        ...(field.tags != null && field.tags.length > 0 ? { tags: field.tags } : {}),
        ...(field.adminLabel == null ? {} : { adminLabel: field.adminLabel }),
        ...(field.adminDescription == null ? {} : { adminDescription: field.adminDescription }),
        ...(field.group == null ? {} : { group: field.group }),
        ...(field.icon == null ? {} : { icon: field.icon }),
      };
      return entry;
    })
    .sort((left, right) => left.id.localeCompare(right.id));
}

/**
 * Selectable exposure fields — registry entries tagged `deliverable` only.
 * Wizard-only or internal fields stay out of admin delivery checklists.
 */
export function buildExposureSelectableFieldCatalog(
  workspaceType: string | null,
): readonly ExposureFieldCatalogEntry[] {
  return buildExposureFieldCatalog(workspaceType).filter(
    (field) => field.tags?.includes(DELIVERABLE_REGISTRY_TAG) === true,
  );
}

export function exposureSelectableFieldIds(workspaceType: string | null): readonly string[] {
  return buildExposureSelectableFieldCatalog(workspaceType).map((field) => field.id);
}

/** Full registry catalog ids — used by engine runtime and cutover definition adaptation. */
export function exposureCatalogFieldIds(workspaceType: string | null): readonly string[] {
  return buildExposureFieldCatalog(workspaceType).map((field) => field.id);
}
