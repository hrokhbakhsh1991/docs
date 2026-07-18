import { BANNER } from "../constants.mjs";

export function generateWorkspaceFinanceBindings(manifests) {
  /** @type {Set<string>} */
  const importLines = new Set();
  /** @type {string[]} */
  const bindingBlocks = [];

  for (const m of manifests) {
    const finance = m.workspaceFinance;
    if (finance === undefined || finance.supported !== true) {
      continue;
    }
    const tw = m.tourWrite;
    if (tw === undefined || typeof tw.workspaceTypeExport !== "string") {
      throw new Error(
        `workspace.manifest.json ${m.id}: workspaceFinance.supported requires tourWrite.workspaceTypeExport`
      );
    }
    importLines.add(`import { ${tw.workspaceTypeExport} } from "${m.package}";`);
    const defaultField =
      finance.defaultModuleEnabledWhenUnset === true
        ? `\n    defaultModuleEnabledWhenUnset: true as const,`
        : "";
    bindingBlocks.push(`  {
    workspaceType: ${tw.workspaceTypeExport},${defaultField}
  },`);
  }

  if (bindingBlocks.length === 0) {
    return `${BANNER}
export const WORKSPACE_FINANCE_BINDINGS = [] as const;

export function isFinanceSupportedWorkspace(_workspaceType: string): boolean {
  return false;
}

export function isFinanceDefaultEnabledWhenModulesUnset(_workspaceType: string): boolean {
  return false;
}
`;
  }

  return `${BANNER}
${[...importLines].join("\n")}

export const WORKSPACE_FINANCE_BINDINGS = [
${bindingBlocks.join("\n")}
] as const;

const supportedWorkspaceTypes = new Set(
  WORKSPACE_FINANCE_BINDINGS.map((binding) => binding.workspaceType as string)
);

const defaultEnabledWhenUnset = new Set(
  WORKSPACE_FINANCE_BINDINGS.filter(
    (binding) => "defaultModuleEnabledWhenUnset" in binding && binding.defaultModuleEnabledWhenUnset === true
  ).map((binding) => binding.workspaceType as string)
);

export function isFinanceSupportedWorkspace(workspaceType: string): boolean {
  return supportedWorkspaceTypes.has(workspaceType);
}

export function isFinanceDefaultEnabledWhenModulesUnset(workspaceType: string): boolean {
  return defaultEnabledWhenUnset.has(workspaceType);
}
`;
}

/**
 * Web operator nav — plugin ids with workspaceFinance.supported (Phase 1.2).
 * Replaces wizardCreate.extendedChrome as the finance hub visibility gate.
 *
 * Architecture-proof ids are merged so generated bindings remain the sole runtime
 * SoT for hub visibility without a full `packages/workspaces/finance-ws2` onboard
 * in this slice (API policy/registry stays Phase 1.1 Denali-only).
 */
const FINANCE_NAV_ARCHITECTURE_PROOF_PLUGIN_IDS = Object.freeze(["finance-ws2"]);

export function generateWorkspaceFinanceNavBindings(manifests) {
  /** @type {Set<string>} */
  const ids = new Set(
    manifests.filter((m) => m.workspaceFinance?.supported === true).map((m) => m.id)
  );
  for (const id of FINANCE_NAV_ARCHITECTURE_PROOF_PLUGIN_IDS) {
    ids.add(id);
  }
  const pluginIds = [...ids].sort().map((id) => `  ${JSON.stringify(id)},`);

  return `${BANNER}
/** Plugin ids with workspaceFinance.supported (+ architecture-proof) — finance hub enablement (Phase 1.2). */
export const WORKSPACE_FINANCE_NAV_PLUGIN_IDS = new Set<string>([
${pluginIds.join("\n")}
]);

export function isFinanceNavPlugin(pluginId: string): boolean {
  return WORKSPACE_FINANCE_NAV_PLUGIN_IDS.has(pluginId);
}
`;
}

