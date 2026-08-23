import { BANNER } from "../constants.mjs";
import { importSpecifier } from "../utils.mjs";

export function generateSettingsEnrichers(manifests) {
  /** @type {{ workspaceType: string; settingsModuleId: string; enrichListBody: string }[]} */
  const bindings = [];
  /** @type {Set<string>} */
  const importLines = new Set();
  let needsEquipmentType = false;
  let needsThemeType = false;

  for (const m of manifests) {
    if (!Array.isArray(m.settingsEnrichers) || m.settingsEnrichers.length === 0) continue;
    const workspaceType = m.workspaceTypes?.[0];
    if (typeof workspaceType !== "string") {
      throw new Error(`workspace.manifest.json ${m.id}: settingsEnrichers requires workspaceTypes`);
    }
    for (const enricher of m.settingsEnrichers) {
      const {
        settingsModuleId,
        module: modulePath,
        export: exportName,
        targetField,
        sourceField,
      } = enricher;
      for (const key of ["settingsModuleId", "module", "export", "targetField", "sourceField"]) {
        if (typeof enricher[key] !== "string" || enricher[key].trim().length === 0) {
          throw new Error(
            `workspace.manifest.json ${m.id}: settingsEnrichers[].${key} is required`
          );
        }
      }
      const spec = importSpecifier(m.package, modulePath);
      importLines.add(`import { ${exportName} } from "${spec}";`);
      if (settingsModuleId === "equipment") {
        needsEquipmentType = true;
      }
      if (settingsModuleId === "tour_themes") {
        needsThemeType = true;
      }
      bindings.push({
        workspaceType,
        settingsModuleId,
        resourceType:
          settingsModuleId === "equipment" ? "EquipmentResource" : "TourThemeResource",
        enrichListBody: `items.map((item) => Object.freeze({
      ...item,
      ${JSON.stringify(targetField)}: ${exportName}(item[${JSON.stringify(sourceField)}]),
    }))`,
      });
    }
  }

  if (bindings.length === 0) {
    return `${BANNER}
export const WORKSPACE_SETTINGS_ENRICHER_BINDINGS = [] as const;

export function enrichSettingsModuleList<T>(_workspaceType: string, _moduleId: string, items: readonly T[]): T[] {
  return [...items];
}
`;
  }

  const typeImports = [];
  if (needsEquipmentType) {
    typeImports.push("EquipmentResource");
  }
  if (needsThemeType) {
    typeImports.push("TourThemeResource");
  }

  const bindingBlocks = bindings.map(
    (b) => `  {
    workspaceType: ${JSON.stringify(b.workspaceType)},
    settingsModuleId: ${JSON.stringify(b.settingsModuleId)},
    enrichList: (items: readonly ${b.resourceType}[]) => ${b.enrichListBody},
  },`
  );

  return `${BANNER}
${[...importLines].join("\n")}
import type { ${typeImports.join(", ")} } from "./settings.types";

export const WORKSPACE_SETTINGS_ENRICHER_BINDINGS = [
${bindingBlocks.join("\n")}
] as const;

export function enrichSettingsModuleList<T>(workspaceType: string, moduleId: string, items: readonly T[]): T[] {
  const binding = WORKSPACE_SETTINGS_ENRICHER_BINDINGS.find(
    (entry) => entry.workspaceType === workspaceType && entry.settingsModuleId === moduleId
  );
  if (binding === undefined) {
    return [...items];
  }
  return binding.enrichList(items as never) as T[];
}
`;
}

export function generateEquipmentIconKeyValidatorBindings(manifests) {
  /** @type {Set<string>} */
  const importLines = new Set();
  /** @type {string[]} */
  const bindingBlocks = [];

  for (const m of manifests) {
    const validator = m.equipmentIconKeyValidator;
    if (validator === undefined) {
      continue;
    }
    const workspaceType = m.workspaceTypes?.[0];
    if (typeof workspaceType !== "string" || workspaceType.length === 0) {
      throw new Error(
        `workspace.manifest.json ${m.id}: equipmentIconKeyValidator requires workspaceTypes[0]`
      );
    }
    const { module: modulePath, export: exportName } = validator;
    for (const key of ["module", "export"]) {
      if (typeof validator[key] !== "string" || validator[key].trim().length === 0) {
        throw new Error(
          `workspace.manifest.json ${m.id}: equipmentIconKeyValidator.${key} is required`
        );
      }
    }
    const spec = importSpecifier(m.package, modulePath);
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

export function generateDevBootstrapBindings(manifests) {
  /** @type {Set<string>} */
  const importLines = new Set();
  /** @type {string[]} */
  const wizardBlocks = [];
  /** @type {string[]} */
  const smokeBlocks = [];

  for (const m of manifests) {
    const devBootstrap = m.devBootstrap;
    if (devBootstrap === undefined) continue;

    const wizardTemplate = devBootstrap.wizardTemplate;
    if (wizardTemplate !== undefined) {
      if (
        typeof wizardTemplate.module !== "string" ||
        typeof wizardTemplate.buildExport !== "string" ||
        !Array.isArray(wizardTemplate.tenantIds)
      ) {
        throw new Error(
          `workspace.manifest.json ${m.id}: devBootstrap.wizardTemplate requires module, buildExport, tenantIds[]`
        );
      }
      importLines.add(`import { ${wizardTemplate.buildExport} } from "${m.package}";`);
      wizardBlocks.push(`  {
    workspaceId: ${JSON.stringify(m.id)},
    tenantIds: ${JSON.stringify(wizardTemplate.tenantIds)},
    buildPayload: ${wizardTemplate.buildExport},
    minPublishedSteps: ${wizardTemplate.minPublishedSteps ?? 1},
  },`);
    }

    const smokeTenant = devBootstrap.smokeTenant;
    if (smokeTenant !== undefined) {
      if (typeof smokeTenant.tenantIdExport !== "string" || typeof smokeTenant.subdomainExport !== "string") {
        throw new Error(
          `workspace.manifest.json ${m.id}: devBootstrap.smokeTenant requires tenantIdExport and subdomainExport`
        );
      }
      importLines.add(`import { ${smokeTenant.tenantIdExport}, ${smokeTenant.subdomainExport} } from "${m.package}";`);
      smokeBlocks.push(`  {
    workspaceId: ${JSON.stringify(m.id)},
    tenantId: ${smokeTenant.tenantIdExport},
    subdomain: ${smokeTenant.subdomainExport},
  },`);
    }
  }

  return `${BANNER}
${[...importLines].sort().join("\n")}

export const WORKSPACE_DEV_WIZARD_TEMPLATE_BINDINGS = [
${wizardBlocks.length > 0 ? wizardBlocks.join("\n") : ""}
] as const;

export const WORKSPACE_DEV_SMOKE_TENANT_BINDINGS = [
${smokeBlocks.length > 0 ? smokeBlocks.join("\n") : ""}
] as const;
`;
}

export function generateWizardTemplatePathAliasBindings(manifests) {
  /** @type {string[]} */
  const bindingBlocks = [];

  for (const m of manifests) {
    const wizardTemplate = m.wizardTemplate;
    if (wizardTemplate === undefined) {
      continue;
    }
    if (
      !Array.isArray(wizardTemplate.pathAliases) ||
      typeof wizardTemplate.aliasCatalogWorkspaceType !== "string"
    ) {
      throw new Error(
        `workspace.manifest.json ${m.id}: wizardTemplate requires pathAliases[] and aliasCatalogWorkspaceType`
      );
    }
    const workspaceType = m.workspaceTypes?.[0];
    if (typeof workspaceType !== "string" || workspaceType.length === 0) {
      throw new Error(`workspace.manifest.json ${m.id}: wizardTemplate requires workspaceTypes[0]`);
    }
    bindingBlocks.push(`  {
    workspaceType: ${JSON.stringify(workspaceType)},
    pathAliases: new Set(${JSON.stringify(wizardTemplate.pathAliases)}),
    aliasCatalogWorkspaceType: ${JSON.stringify(wizardTemplate.aliasCatalogWorkspaceType)},
  },`);
  }

  if (bindingBlocks.length === 0) {
    return `${BANNER}
export type WorkspaceWizardTemplatePathAliasBinding = {
  readonly workspaceType: string;
  readonly pathAliases: ReadonlySet<string>;
  readonly aliasCatalogWorkspaceType: string;
};

export const WORKSPACE_WIZARD_TEMPLATE_PATH_ALIAS_BINDINGS: readonly WorkspaceWizardTemplatePathAliasBinding[] =
  [];

export function resolveWizardTemplatePathAliasBinding(
  _workspaceType: string,
): WorkspaceWizardTemplatePathAliasBinding | undefined {
  return undefined;
}
`;
  }

  return `${BANNER}
export type WorkspaceWizardTemplatePathAliasBinding = {
  readonly workspaceType: string;
  readonly pathAliases: ReadonlySet<string>;
  readonly aliasCatalogWorkspaceType: string;
};

export const WORKSPACE_WIZARD_TEMPLATE_PATH_ALIAS_BINDINGS = [
${bindingBlocks.join("\n")}
] as const satisfies readonly WorkspaceWizardTemplatePathAliasBinding[];

export function resolveWizardTemplatePathAliasBinding(
  workspaceType: string,
): WorkspaceWizardTemplatePathAliasBinding | undefined {
  return WORKSPACE_WIZARD_TEMPLATE_PATH_ALIAS_BINDINGS.find(
    (entry) => entry.workspaceType === workspaceType,
  );
}
`;
}

export function generateWizardTemplateEnforcementBindings(manifests) {
  /** @type {Set<string>} */
  const importLines = new Set();
  /** @type {string[]} */
  const bindingBlocks = [];

  for (const m of manifests) {
    const enforcement = m.wizardTemplateEnforcement;
    const tw = m.tourWrite;
    if (enforcement === undefined || tw === undefined) {
      continue;
    }
    const { module: modulePath, assertFrozenFieldsExport, normalizeStepsExport } = enforcement;
    for (const key of ["module", "assertFrozenFieldsExport", "normalizeStepsExport"]) {
      if (typeof enforcement[key] !== "string" || enforcement[key].trim().length === 0) {
        throw new Error(`workspace.manifest.json ${m.id}: wizardTemplateEnforcement.${key} is required`);
      }
    }
    const alias = `${m.id.replace(/-/g, "_")}_wizard_template_enforcement`;
    const spec = importSpecifier(m.package, modulePath);
    importLines.add(`import { ${tw.workspaceTypeExport} } from "${m.package}";`);
    importLines.add(
      `import { ${assertFrozenFieldsExport}, ${normalizeStepsExport} } from "${spec}";`
    );
    bindingBlocks.push(`  {
    workspaceType: ${tw.workspaceTypeExport},
    assertFrozenFields: ${assertFrozenFieldsExport},
    normalizeSteps: ${normalizeStepsExport},
  },`);
  }

  if (bindingBlocks.length === 0) {
    return `${BANNER}
export const WORKSPACE_WIZARD_TEMPLATE_ENFORCEMENT_BINDINGS = [] as const;

export function resolveWizardTemplateEnforcementBinding(_workspaceType: string) {
  return undefined;
}
`;
  }

  return `${BANNER}
${[...importLines].join("\n")}

export const WORKSPACE_WIZARD_TEMPLATE_ENFORCEMENT_BINDINGS = [
${bindingBlocks.join("\n")}
] as const;

export function resolveWizardTemplateEnforcementBinding(workspaceType: string) {
  return WORKSPACE_WIZARD_TEMPLATE_ENFORCEMENT_BINDINGS.find(
    (entry) => entry.workspaceType === workspaceType
  );
}
`;
}
