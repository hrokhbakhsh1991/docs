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
