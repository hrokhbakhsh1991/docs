import { BANNER } from "../constants.mjs";
import { importSpecifier } from "../utils.mjs";

const EQUIPMENT_SURFACE_KEYS = [
  "operatorSettings",
  "wizardTourField",
  "catalogDetailSection",
  "guestLandingSection",
  "registrationSnapshot",
];

/**
 * Resolve workspaceEquipment block with legacy Denali alias fallback during transition.
 *
 * @param {Record<string, unknown>} manifest
 */
export function resolveWorkspaceEquipmentManifest(manifest) {
  const block = manifest.workspaceEquipment;
  if (block !== undefined) {
    return block;
  }
  if (manifest.id !== "denali") {
    return undefined;
  }
  const legacyValidator = manifest.equipmentIconKeyValidator;
  const legacyUi = manifest.settingsEquipmentUi;
  const legacyEnrichers = Array.isArray(manifest.settingsEnrichers)
    ? manifest.settingsEnrichers.find((row) => row?.settingsModuleId === "equipment")
    : undefined;
  if (legacyValidator === undefined && legacyUi === undefined && legacyEnrichers === undefined) {
    return undefined;
  }
  /** @type {Record<string, unknown>} */
  const resolved = {
    supported: true,
    defaultModuleEnabledWhenUnset: true,
    capabilities: {
      operatorSettings: legacyValidator !== undefined || legacyUi !== undefined,
      wizardTourField: true,
      catalogDetailSection: true,
      guestLandingSection:
        manifest.guestLanding?.sections?.equipment === true,
      registrationSnapshot: true,
    },
  };
  if (legacyValidator !== undefined) {
    resolved.iconKeyValidator = legacyValidator;
  }
  if (legacyEnrichers !== undefined) {
    resolved.settingsEnricher = {
      module: legacyEnrichers.module,
      export: legacyEnrichers.export,
      targetField: legacyEnrichers.targetField,
      sourceField: legacyEnrichers.sourceField,
    };
  }
  if (legacyUi !== undefined) {
    resolved.settingsEquipmentUi = legacyUi;
  }
  return resolved;
}

/**
 * @param {Record<string, unknown>} manifest
 */
export function assertWorkspaceEquipmentManifest(manifest) {
  const equipment = resolveWorkspaceEquipmentManifest(manifest);
  if (equipment === undefined) {
    return;
  }
  if (typeof equipment !== "object" || equipment === null || Array.isArray(equipment)) {
    throw new Error(`workspace.manifest.json ${manifest.id}: workspaceEquipment must be an object`);
  }
  if (typeof equipment.supported !== "boolean") {
    throw new Error(`workspace.manifest.json ${manifest.id}: workspaceEquipment.supported must be boolean`);
  }
  if (equipment.supported === false) {
    for (const key of ["iconKeyValidator", "settingsEnricher", "settingsEquipmentUi", "fieldModule"]) {
      if (equipment[key] !== undefined) {
        throw new Error(
          `workspace.manifest.json ${manifest.id}: workspaceEquipment.supported=false forbids ${key}`
        );
      }
    }
    return;
  }
  const caps = equipment.capabilities ?? {};
  if (typeof caps !== "object" || caps === null || Array.isArray(caps)) {
    throw new Error(`workspace.manifest.json ${manifest.id}: workspaceEquipment.capabilities must be an object`);
  }
  for (const key of EQUIPMENT_SURFACE_KEYS) {
    if (caps[key] !== undefined && typeof caps[key] !== "boolean") {
      throw new Error(
        `workspace.manifest.json ${manifest.id}: workspaceEquipment.capabilities.${key} must be boolean`
      );
    }
  }
  if (caps.operatorSettings === true) {
    if (equipment.iconKeyValidator === undefined) {
      throw new Error(
        `workspace.manifest.json ${manifest.id}: capabilities.operatorSettings requires iconKeyValidator`
      );
    }
    if (equipment.settingsEquipmentUi === undefined) {
      throw new Error(
        `workspace.manifest.json ${manifest.id}: capabilities.operatorSettings requires settingsEquipmentUi`
      );
    }
  }
  if (caps.wizardTourField === true && equipment.fieldModule === undefined) {
    throw new Error(
      `workspace.manifest.json ${manifest.id}: capabilities.wizardTourField requires fieldModule`
    );
  }
}

/**
 * @param {Record<string, unknown>} equipment
 */
function resolveEquipmentSurfaceFlags(equipment) {
  const caps = equipment.capabilities ?? {};
  return Object.fromEntries(
    EQUIPMENT_SURFACE_KEYS.map((key) => [key, caps[key] === true])
  );
}

/**
 * @param {readonly Record<string, unknown>[]} manifests
 */
export function generateWorkspaceEquipmentCapabilities(manifests) {
  /** @type {string[]} */
  const entries = [];

  for (const manifest of manifests) {
    assertWorkspaceEquipmentManifest(manifest);
    const equipment = resolveWorkspaceEquipmentManifest(manifest);
    if (equipment === undefined || equipment.supported !== true) {
      continue;
    }
    const workspaceTypes = Array.isArray(manifest.workspaceTypes) ? manifest.workspaceTypes : [];
    const surfaces = resolveEquipmentSurfaceFlags(equipment);
    for (const workspaceType of workspaceTypes) {
      if (typeof workspaceType !== "string" || workspaceType.trim().length === 0) {
        continue;
      }
      entries.push(`  ${JSON.stringify(workspaceType)}: {
    supported: true as const,
    defaultModuleEnabledWhenUnset: ${equipment.defaultModuleEnabledWhenUnset === true ? "true" : "false"} as const,
    operatorSettings: ${surfaces.operatorSettings ? "true" : "false"} as const,
    wizardTourField: ${surfaces.wizardTourField ? "true" : "false"} as const,
    catalogDetailSection: ${surfaces.catalogDetailSection ? "true" : "false"} as const,
    guestLandingSection: ${surfaces.guestLandingSection ? "true" : "false"} as const,
    registrationSnapshot: ${surfaces.registrationSnapshot ? "true" : "false"} as const,
  },`);
    }
  }

  if (entries.length === 0) {
    return `${BANNER}
export type WorkspaceEquipmentCapabilities = {
  readonly supported: true;
  readonly defaultModuleEnabledWhenUnset: boolean;
  readonly operatorSettings: boolean;
  readonly wizardTourField: boolean;
  readonly catalogDetailSection: boolean;
  readonly guestLandingSection: boolean;
  readonly registrationSnapshot: boolean;
};

export const WORKSPACE_EQUIPMENT_CAPABILITIES = {} as const;

export function getWorkspaceEquipmentCapabilities(
  _workspaceType: string
): WorkspaceEquipmentCapabilities | null {
  return null;
}
`;
  }

  return `${BANNER}
export type WorkspaceEquipmentCapabilities = {
  readonly supported: true;
  readonly defaultModuleEnabledWhenUnset: boolean;
  readonly operatorSettings: boolean;
  readonly wizardTourField: boolean;
  readonly catalogDetailSection: boolean;
  readonly guestLandingSection: boolean;
  readonly registrationSnapshot: boolean;
};

export const WORKSPACE_EQUIPMENT_CAPABILITIES = {
${entries.join("\n")}
} as const satisfies Record<string, WorkspaceEquipmentCapabilities>;

export function getWorkspaceEquipmentCapabilities(
  workspaceType: string
): WorkspaceEquipmentCapabilities | null {
  return (
  WORKSPACE_EQUIPMENT_CAPABILITIES[
    workspaceType as keyof typeof WORKSPACE_EQUIPMENT_CAPABILITIES
  ] ?? null
  );
}
`;
}

/**
 * @param {readonly Record<string, unknown>[]} manifests
 */
export function generateWorkspaceEquipmentSettingsUiBindings(manifests) {
  /** @type {Set<string>} */
  const importLines = new Set();
  /** @type {string[]} */
  const bindingBlocks = [];

  for (const manifest of manifests) {
    const equipment = resolveWorkspaceEquipmentManifest(manifest);
    if (equipment === undefined || equipment.supported !== true) {
      continue;
    }
    const caps = equipment.capabilities ?? {};
    if (caps.operatorSettings !== true) {
      continue;
    }
    const ui = equipment.settingsEquipmentUi ?? manifest.settingsEquipmentUi;
    if (ui === undefined) {
      continue;
    }
    const workspaceType = manifest.workspaceTypes?.[0];
    if (typeof workspaceType !== "string" || workspaceType.length === 0) {
      throw new Error(`workspace.manifest.json ${manifest.id}: workspaceEquipment requires workspaceTypes[0]`);
    }
    const { module: modulePath, export: exportName } = ui;
    for (const key of ["module", "export"]) {
      if (typeof ui[key] !== "string" || ui[key].trim().length === 0) {
        throw new Error(`workspace.manifest.json ${manifest.id}: settingsEquipmentUi.${key} is required`);
      }
    }
    const spec = importSpecifier(manifest.package, modulePath);
    importLines.add(`import { ${exportName} } from "${spec}";`);
    bindingBlocks.push(`  {
    workspaceType: ${JSON.stringify(workspaceType)},
    loadSurface: ${exportName},
  },`);
  }

  if (bindingBlocks.length === 0) {
    return `${BANNER}
export const WORKSPACE_EQUIPMENT_SETTINGS_UI_BINDINGS = [] as const;

export function resolveWorkspaceEquipmentSettingsUiLoader(
  _workspaceType: string
): (() => Promise<unknown>) | undefined {
  return undefined;
}
`;
  }

  return `${BANNER}
${[...importLines].join("\n")}

export const WORKSPACE_EQUIPMENT_SETTINGS_UI_BINDINGS = [
${bindingBlocks.join("\n")}
] as const;

export function resolveWorkspaceEquipmentSettingsUiLoader(
  workspaceType: string
): (() => Promise<unknown>) | undefined {
  const binding = WORKSPACE_EQUIPMENT_SETTINGS_UI_BINDINGS.find(
    (entry) => entry.workspaceType === workspaceType
  );
  return binding?.loadSurface;
}
`;
}

/**
 * Equipment icon validator + enricher bindings (moved from settings-api reader seam).
 *
 * @param {readonly Record<string, unknown>[]} manifests
 */
export function generateWorkspaceEquipmentBindings(manifests) {
  return {
    iconKeyValidator: generateWorkspaceEquipmentIconKeyValidatorBindings(manifests),
    settingsEnricher: generateWorkspaceEquipmentSettingsEnricherBindings(manifests),
    settingsUi: generateWorkspaceEquipmentSettingsUiBindings(manifests),
    capabilities: generateWorkspaceEquipmentCapabilities(manifests),
    fieldModule: generateWorkspaceEquipmentFieldModuleBindings(manifests),
  };
}

/**
 * @param {readonly Record<string, unknown>[]} manifests
 */
export function generateWorkspaceEquipmentIconKeyValidatorBindings(manifests) {
  /** @type {Set<string>} */
  const importLines = new Set();
  /** @type {string[]} */
  const bindingBlocks = [];

  for (const manifest of manifests) {
    const equipment = resolveWorkspaceEquipmentManifest(manifest);
    if (equipment === undefined || equipment.supported !== true) {
      continue;
    }
    const validator = equipment.iconKeyValidator ?? manifest.equipmentIconKeyValidator;
    if (validator === undefined) {
      continue;
    }
    const workspaceType = manifest.workspaceTypes?.[0];
    if (typeof workspaceType !== "string" || workspaceType.length === 0) {
      throw new Error(
        `workspace.manifest.json ${manifest.id}: workspaceEquipment.iconKeyValidator requires workspaceTypes[0]`
      );
    }
    const { module: modulePath, export: exportName } = validator;
    for (const key of ["module", "export"]) {
      if (typeof validator[key] !== "string" || validator[key].trim().length === 0) {
        throw new Error(
          `workspace.manifest.json ${manifest.id}: workspaceEquipment.iconKeyValidator.${key} is required`
        );
      }
    }
    const spec = importSpecifier(manifest.package, modulePath);
    importLines.add(`import { ${exportName} } from "${spec}";`);
    bindingBlocks.push(`  {
    workspaceType: ${JSON.stringify(workspaceType)},
    validateEquipmentIconKey: ${exportName},
  },`);
  }

  if (bindingBlocks.length === 0) {
    return `${BANNER}
export const WORKSPACE_EQUIPMENT_ICON_KEY_VALIDATOR_BINDINGS = [] as const;

export function resolveEquipmentIconKeyValidator(
  _workspaceType: string
): ((value: string) => boolean) | undefined {
  return undefined;
}
`;
  }

  return `${BANNER}
${[...importLines].join("\n")}

export const WORKSPACE_EQUIPMENT_ICON_KEY_VALIDATOR_BINDINGS = [
${bindingBlocks.join("\n")}
] as const;

export function resolveEquipmentIconKeyValidator(
  workspaceType: string
): ((value: string) => boolean) | undefined {
  const binding = WORKSPACE_EQUIPMENT_ICON_KEY_VALIDATOR_BINDINGS.find(
    (entry) => entry.workspaceType === workspaceType
  );
  return binding?.validateEquipmentIconKey;
}
`;
}

/**
 * @param {readonly Record<string, unknown>[]} manifests
 */
export function generateWorkspaceEquipmentSettingsEnricherBindings(manifests) {
  /** @type {Set<string>} */
  const importLines = new Set();
  /** @type {{ workspaceType: string; enrichListBody: string }[]} */
  const bindings = [];

  for (const manifest of manifests) {
    const equipment = resolveWorkspaceEquipmentManifest(manifest);
    if (equipment === undefined || equipment.supported !== true) {
      continue;
    }
    const enricher = equipment.settingsEnricher;
    const legacyRow = Array.isArray(manifest.settingsEnrichers)
      ? manifest.settingsEnrichers.find((row) => row?.settingsModuleId === "equipment")
      : undefined;
    const resolved = enricher ?? legacyRow;
    if (resolved === undefined) {
      continue;
    }
    const workspaceType = manifest.workspaceTypes?.[0];
    if (typeof workspaceType !== "string") {
      throw new Error(`workspace.manifest.json ${manifest.id}: workspaceEquipment requires workspaceTypes[0]`);
    }
    const { module: modulePath, export: exportName, targetField, sourceField } = resolved;
    for (const key of ["module", "export", "targetField", "sourceField"]) {
      if (typeof resolved[key] !== "string" || resolved[key].trim().length === 0) {
        throw new Error(`workspace.manifest.json ${manifest.id}: workspaceEquipment.settingsEnricher.${key} is required`);
      }
    }
    const spec = importSpecifier(manifest.package, modulePath);
    importLines.add(`import { ${exportName} } from "${spec}";`);
    bindings.push({
      workspaceType,
      enrichListBody: `items.map((item) => Object.freeze({
      ...item,
      ${JSON.stringify(targetField)}: ${exportName}(item[${JSON.stringify(sourceField)}]),
    }))`,
    });
  }

  if (bindings.length === 0) {
    return null;
  }

  return { importLines: [...importLines], bindings };
}

/**
 * CW7-03 — optional field-registry fragment bindings from workspaceEquipment.fieldModule.
 *
 * @param {readonly Record<string, unknown>[]} manifests
 */
export function generateWorkspaceEquipmentFieldModuleBindings(manifests) {
  /** @type {Set<string>} */
  const importLines = new Set();
  /** @type {string[]} */
  const bindingBlocks = [];

  for (const manifest of manifests) {
    const equipment = resolveWorkspaceEquipmentManifest(manifest);
    if (equipment === undefined || equipment.supported !== true) {
      continue;
    }
    const caps = equipment.capabilities ?? {};
    if (caps.wizardTourField !== true) {
      continue;
    }
    const fieldModule = equipment.fieldModule;
    if (fieldModule === undefined) {
      continue;
    }
    const workspaceType = manifest.workspaceTypes?.[0];
    if (typeof workspaceType !== "string" || workspaceType.trim().length === 0) {
      throw new Error(
        `workspace.manifest.json ${manifest.id}: workspaceEquipment.fieldModule requires workspaceTypes[0]`
      );
    }
    for (const key of ["module", "export"]) {
      if (typeof fieldModule[key] !== "string" || fieldModule[key].trim().length === 0) {
        throw new Error(
          `workspace.manifest.json ${manifest.id}: workspaceEquipment.fieldModule.${key} is required`
        );
      }
    }
    const alias = `${String(manifest.id).replace(/-/g, "_")}_equipment_field_module`;
    const spec = importSpecifier(manifest.package, fieldModule.module);
    importLines.add(`import { ${fieldModule.export} as ${alias} } from "${spec}";`);
    bindingBlocks.push(`  {
    workspaceType: ${JSON.stringify(workspaceType)},
    fieldRegistryFragment: ${alias},
  },`);
  }

  if (bindingBlocks.length === 0) {
    return `${BANNER}
import type { WorkspaceEquipmentFieldRegistryFragment } from "@app-tour/workspace-sdk/equipment";

export type WorkspaceEquipmentFieldModuleBinding = {
  readonly workspaceType: string;
  readonly fieldRegistryFragment: WorkspaceEquipmentFieldRegistryFragment;
};

export const WORKSPACE_EQUIPMENT_FIELD_MODULE_BINDINGS: readonly WorkspaceEquipmentFieldModuleBinding[] =
  [];

export function resolveWorkspaceEquipmentFieldRegistryFragment(
  _workspaceType: string
): WorkspaceEquipmentFieldRegistryFragment | undefined {
  return undefined;
}
`;
  }

  return `${BANNER}
import type { WorkspaceEquipmentFieldRegistryFragment } from "@app-tour/workspace-sdk/equipment";
${[...importLines].join("\n")}

export type WorkspaceEquipmentFieldModuleBinding = {
  readonly workspaceType: string;
  readonly fieldRegistryFragment: WorkspaceEquipmentFieldRegistryFragment;
};

export const WORKSPACE_EQUIPMENT_FIELD_MODULE_BINDINGS: readonly WorkspaceEquipmentFieldModuleBinding[] = [
${bindingBlocks.join("\n")}
] as const;

export function resolveWorkspaceEquipmentFieldRegistryFragment(
  workspaceType: string
): WorkspaceEquipmentFieldRegistryFragment | undefined {
  const binding = WORKSPACE_EQUIPMENT_FIELD_MODULE_BINDINGS.find(
    (entry) => entry.workspaceType === workspaceType
  );
  return binding?.fieldRegistryFragment;
}
`;
}
