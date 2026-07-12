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
