import type { WorkspacePlugin } from "@app-tour/workspace-sdk";

import { resolveWorkspaceTypeForTenant } from "../tenant/resolve-workspace-type";
import { resolveWorkspacePluginForTenantContext } from "../workspace/resolve-workspace-plugin-for-tenant-context";
import { resolveWorkspacePluginForType } from "../workspace/resolve-workspace-plugin";

import type { WizardTemplatePayloadV1 } from "./settings.types";

/** INV-WIZ-002 — denali Layer C rows carry this tag via `denali-plugin-adapter`. */
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

function isWizardTemplateSelectableField(field: {
  readonly tags?: readonly string[];
}): boolean {
  return !field.tags?.includes(WIZARD_PALETTE_ROADMAP_TAG);
}

export class SettingsWizardUnknownFieldError extends Error {
  readonly code = "SETTINGS_WIZARD_UNKNOWN_FIELD" as const;

  constructor(readonly canonicalPath: string) {
    super(`SETTINGS_WIZARD_UNKNOWN_FIELD:${canonicalPath}`);
    this.name = "SettingsWizardUnknownFieldError";
  }
}

/** Thin-shell bridge until Denali full-create lands — web may save `title` while API workspace is starter. */
const STARTER_WIZARD_TEMPLATE_PATH_ALIASES = new Set(["title"]);

export class SettingsWizardRoadmapFieldError extends Error {
  readonly code = "SETTINGS_WIZARD_ROADMAP_FIELD" as const;

  constructor(readonly canonicalPath: string) {
    super(`SETTINGS_WIZARD_ROADMAP_FIELD:${canonicalPath}`);
    this.name = "SettingsWizardRoadmapFieldError";
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

function isKnownWizardTemplatePath(
  canonicalPath: string,
  workspaceType: string,
  primaryCatalog: ReadonlySet<string>
): boolean {
  if (primaryCatalog.has(canonicalPath)) {
    return true;
  }
  if (workspaceType === "starter" && STARTER_WIZARD_TEMPLATE_PATH_ALIASES.has(canonicalPath)) {
    const denaliPlugin = resolveWorkspacePluginForType("denali");
    return listWizardTemplateCatalogPaths(denaliPlugin).has(canonicalPath);
  }
  return false;
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
      const registryField = plugin.fieldRegistry.fields.find((entry) => entry.canonicalPath === path);
      if (
        registryField != null &&
        isWizardTemplatePaletteField(registryField, inactiveFieldGroups) &&
        !isWizardTemplateSelectableField(registryField)
      ) {
        throw new SettingsWizardRoadmapFieldError(path);
      }
      if (!isKnownWizardTemplatePath(path, workspaceType, catalog)) {
        throw new SettingsWizardUnknownFieldError(path);
      }
    }
  }
}
