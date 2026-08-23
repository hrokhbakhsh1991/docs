import type { WorkspacePlugin } from "@app-tour/workspace-sdk";

import { resolveWorkspaceTypeForTenant } from "../tenant/resolve-workspace-type";
import { resolveWorkspacePluginForTenantContext } from "../workspace/resolve-workspace-plugin-for-tenant-context";
import { resolveWorkspacePluginForType } from "../workspace/resolve-workspace-plugin";
import { resolveWizardTemplateEnforcementBinding } from "./workspace-wizard-template-enforcement-bindings.generated.ts";
import { resolveWizardTemplatePathAliasBinding } from "./workspace-wizard-template-path-alias-bindings.generated.ts";

import type { WizardTemplatePayloadV1 } from "./settings.types";

/** INV-WIZ-002 — workspace adapters tag rows that must stay out of the editable overlay. */
const WIZARD_OVERLAY_EXCLUDE_TAG = "wizard_overlay_exclude" as const;

/** INV-WIZ-009 — roadmap rows visible in palette but not activatable. */
const WIZARD_PALETTE_ROADMAP_TAG = "wizard_palette_roadmap" as const;

function isWizardTemplatePaletteField(
  field: {
    readonly tags?: readonly string[];
    readonly groupSlug?: string;
  },
  inactiveFieldGroups: readonly string[]
): boolean {
  if (field.tags?.includes(WIZARD_OVERLAY_EXCLUDE_TAG)) {
    return false;
  }
  const groupSlug = field.groupSlug?.trim();
  if (groupSlug !== undefined && groupSlug.length > 0 && inactiveFieldGroups.includes(groupSlug)) {
    return false;
  }
  return true;
}

function isWizardTemplateSelectableField(field: { readonly tags?: readonly string[] }): boolean {
  return !field.tags?.includes(WIZARD_PALETTE_ROADMAP_TAG);
}

export class SettingsWizardUnknownFieldError extends Error {
  readonly code = "SETTINGS_WIZARD_UNKNOWN_FIELD" as const;

  constructor(readonly canonicalPath: string) {
    super(`SETTINGS_WIZARD_UNKNOWN_FIELD:${canonicalPath}`);
    this.name = "SettingsWizardUnknownFieldError";
  }
}

export class SettingsWizardRoadmapFieldError extends Error {
  readonly code = "SETTINGS_WIZARD_ROADMAP_FIELD" as const;

  constructor(readonly canonicalPath: string) {
    super(`SETTINGS_WIZARD_ROADMAP_FIELD:${canonicalPath}`);
    this.name = "SettingsWizardRoadmapFieldError";
  }
}

export class SettingsWizardFrozenFieldMissingError extends Error {
  readonly code = "SETTINGS_WIZARD_FROZEN_FIELD_MISSING" as const;

  constructor(readonly canonicalPath: string) {
    super(`SETTINGS_WIZARD_FROZEN_FIELD_MISSING:${canonicalPath}`);
    this.name = "SettingsWizardFrozenFieldMissingError";
  }
}

export function listWizardTemplateCatalogPaths(plugin: WorkspacePlugin): ReadonlySet<string> {
  const inactiveFieldGroups = plugin.wizard.inactiveFieldGroups;
  return new Set(
    plugin.fieldRegistry.fields
      .filter((field) => isWizardTemplatePaletteField(field, inactiveFieldGroups))
      .filter((field) => isWizardTemplateSelectableField(field))
      .map((field) => field.canonicalPath)
  );
}

/** Manifest `wizardTemplate.pathAliases` — starter may alias paths against another workspace catalog. */
async function isKnownWizardTemplatePath(
  canonicalPath: string,
  workspaceType: string,
  primaryCatalog: ReadonlySet<string>
): Promise<boolean> {
  if (primaryCatalog.has(canonicalPath)) {
    return true;
  }
  const aliasBinding = resolveWizardTemplatePathAliasBinding(workspaceType);
  if (aliasBinding === undefined || !aliasBinding.pathAliases.has(canonicalPath)) {
    return false;
  }
  const aliasPlugin = await resolveWorkspacePluginForType(aliasBinding.aliasCatalogWorkspaceType);
  return listWizardTemplateCatalogPaths(aliasPlugin).has(canonicalPath);
}

export async function assertWizardTemplateFieldsKnown(
  tenantId: string,
  payload: WizardTemplatePayloadV1
): Promise<void> {
  if (payload.published !== true || payload.steps === undefined || payload.steps.length === 0) {
    return;
  }

  const workspaceType = await resolveWorkspaceTypeForTenant(tenantId);
  const plugin = await resolveWorkspacePluginForTenantContext(tenantId, workspaceType);
  const catalog = listWizardTemplateCatalogPaths(plugin);
  const inactiveFieldGroups = plugin.wizard.inactiveFieldGroups;

  for (const step of payload.steps) {
    for (const field of step.fields) {
      const path = field.canonicalPath.trim();
      if (path.length === 0) {
        continue;
      }
      const registryField = plugin.fieldRegistry.fields.find(
        (entry) => entry.canonicalPath === path
      );
      if (
        registryField != null &&
        isWizardTemplatePaletteField(registryField, inactiveFieldGroups) &&
        !isWizardTemplateSelectableField(registryField)
      ) {
        throw new SettingsWizardRoadmapFieldError(path);
      }
      if (!(await isKnownWizardTemplatePath(path, workspaceType, catalog))) {
        throw new SettingsWizardUnknownFieldError(path);
      }
    }
  }
}

export async function assertWorkspaceWizardTemplateEnforcedFieldsForTenant(
  tenantId: string,
  payload: WizardTemplatePayloadV1
): Promise<void> {
  if (payload.published !== true || payload.steps === undefined || payload.steps.length === 0) {
    return;
  }
  const workspaceType = await resolveWorkspaceTypeForTenant(tenantId);
  const binding = resolveWizardTemplateEnforcementBinding(workspaceType);
  if (binding === undefined) {
    return;
  }
  try {
    binding.assertFrozenFields(payload);
  } catch (error) {
    // Workspace bindings may throw product-named errors; match by stable code.
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: unknown }).code === "SETTINGS_WIZARD_FROZEN_FIELD_MISSING" &&
      "canonicalPath" in error &&
      typeof (error as { canonicalPath: unknown }).canonicalPath === "string"
    ) {
      throw new SettingsWizardFrozenFieldMissingError(
        (error as { canonicalPath: string }).canonicalPath
      );
    }
    throw error;
  }
}

export function normalizeWorkspaceWizardTemplatePayloadForTenant(
  workspaceType: string,
  payload: WizardTemplatePayloadV1
): WizardTemplatePayloadV1 {
  const binding = resolveWizardTemplateEnforcementBinding(workspaceType);
  if (binding === undefined) {
    return payload;
  }
  return binding.normalizeSteps(payload) as WizardTemplatePayloadV1;
}
