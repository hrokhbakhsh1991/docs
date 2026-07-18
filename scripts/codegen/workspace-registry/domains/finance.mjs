import { BANNER } from "../constants.mjs";
import { importSpecifier } from "../utils.mjs";

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
    if (finance.registryOnly === true) {
      throw new Error(
        `workspace.manifest.json ${m.id}: workspaceFinance.supported cannot be true when registryOnly is true`
      );
    }
    if (finance.ledgerPolicy === undefined || finance.receiptDefaults === undefined) {
      throw new Error(
        `workspace.manifest.json ${m.id}: workspaceFinance.supported requires ledgerPolicy and receiptDefaults (Phase 1.10)`
      );
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
 * SoT is manifest-only: no architecture-proof / fake plugin ids.
 * Registry fixture `finance-ws2` must not appear here until a real workspace package
 * declares `workspaceFinance.supported` (fixture ≠ production enablement).
 */
export function generateWorkspaceFinanceNavBindings(manifests) {
  /** @type {Set<string>} */
  const ids = new Set(
    manifests.filter((m) => m.workspaceFinance?.supported === true).map((m) => m.id)
  );
  const pluginIds = [...ids].sort().map((id) => `  ${JSON.stringify(id)},`);

  return `${BANNER}
/** Plugin ids with workspaceFinance.supported — finance hub enablement (Phase 1.2). */
export const WORKSPACE_FINANCE_NAV_PLUGIN_IDS = new Set<string>([
${pluginIds.join("\n")}
]);

export function isFinanceNavPlugin(pluginId: string): boolean {
  return WORKSPACE_FINANCE_NAV_PLUGIN_IDS.has(pluginId);
}
`;
}

/**
 * Web finance ops panel defaults — pluginId → workspace ops manifest (Phase 1.9.2).
 * Generic apps/web must resolve via these bindings; never hard-import a workspace package.
 */
export function generateWorkspaceFinanceOpsBindings(manifests) {
  /** @type {string[]} */
  const importLines = [];
  /** @type {string[]} */
  const bindingEntries = [];

  for (const m of manifests) {
    const ops = m.workspaceFinance?.opsManifest;
    if (ops === undefined) {
      continue;
    }
    if (typeof ops.module !== "string" || ops.module.length === 0) {
      throw new Error(`workspace.manifest.json ${m.id}: workspaceFinance.opsManifest.module required`);
    }
    if (typeof ops.defaultExport !== "string" || ops.defaultExport.length === 0) {
      throw new Error(
        `workspace.manifest.json ${m.id}: workspaceFinance.opsManifest.defaultExport required`
      );
    }
    if (typeof ops.resolveFromThemeExport !== "string" || ops.resolveFromThemeExport.length === 0) {
      throw new Error(
        `workspace.manifest.json ${m.id}: workspaceFinance.opsManifest.resolveFromThemeExport required`
      );
    }
    const spec = importSpecifier(m.package, ops.module);
    const defaultAlias = `${m.id.replace(/[^a-zA-Z0-9]/g, "_")}_opsDefault`;
    const resolveAlias = `${m.id.replace(/[^a-zA-Z0-9]/g, "_")}_opsResolveFromTheme`;
    importLines.push(
      `import {\n  ${ops.defaultExport} as ${defaultAlias},\n  ${ops.resolveFromThemeExport} as ${resolveAlias},\n} from "${spec}";`
    );
    bindingEntries.push(`  ${JSON.stringify(m.id)}: {
    defaultManifest: ${defaultAlias},
    resolveFromTheme: ${resolveAlias},
  },`);
  }

  if (bindingEntries.length === 0) {
    return `${BANNER}
import type { FinanceOpsCapability } from "@/finance/finance-ops-capability-contract";

export const WORKSPACE_FINANCE_OPS_PLUGIN_IDS = new Set<string>([]);

export function hasFinanceOpsManifest(pluginId: string): boolean {
  return false;
}

export function resolveWorkspaceFinanceOpsManifest(
  pluginId: string,
  _theme: unknown = null
): FinanceOpsCapability {
  throw new Error(\`Finance ops capability not registered for pluginId=\${pluginId}\`);
}
`;
  }

  return `${BANNER}
import type { FinanceOpsCapability } from "@/finance/finance-ops-capability-contract";

${importLines.join("\n\n")}

export const WORKSPACE_FINANCE_OPS_BINDINGS = {
${bindingEntries.join("\n")}
} as const;

export const WORKSPACE_FINANCE_OPS_PLUGIN_IDS = new Set<string>(
  Object.keys(WORKSPACE_FINANCE_OPS_BINDINGS)
);

export function hasFinanceOpsManifest(pluginId: string): boolean {
  return pluginId in WORKSPACE_FINANCE_OPS_BINDINGS;
}

export function resolveWorkspaceFinanceOpsManifest(
  pluginId: string,
  theme: unknown = null
): FinanceOpsCapability {
  const binding = WORKSPACE_FINANCE_OPS_BINDINGS[pluginId as keyof typeof WORKSPACE_FINANCE_OPS_BINDINGS];
  if (binding === undefined) {
    throw new Error(\`Finance ops capability not registered for pluginId=\${pluginId}\`);
  }
  if (theme === null || theme === undefined) {
    return binding.defaultManifest;
  }
  return binding.resolveFromTheme(theme);
}
`;
}

/**
 * @param {unknown} block
 * @param {string} workspaceId
 * @param {string} field
 */
function assertModuleExport(block, workspaceId, field) {
  if (block === undefined || typeof block !== "object" || block === null) {
    throw new Error(`workspace.manifest.json ${workspaceId}: workspaceFinance.${field} required`);
  }
  const rec = /** @type {Record<string, unknown>} */ (block);
  if (typeof rec.module !== "string" || rec.module.length === 0) {
    throw new Error(`workspace.manifest.json ${workspaceId}: workspaceFinance.${field}.module required`);
  }
  if (typeof rec.export !== "string" || rec.export.length === 0) {
    throw new Error(`workspace.manifest.json ${workspaceId}: workspaceFinance.${field}.export required`);
  }
  return { module: rec.module, export: rec.export };
}

/**
 * API finance dependency factories — workspaceType → ledger + receipt defaults (Phase 1.10).
 * Booking projection stays platform-owned (not generated).
 */
export function generateWorkspaceFinanceDependencyBindings(manifests) {
  /** @type {string[]} */
  const importLines = [];
  /** @type {string[]} */
  const bindingEntries = [];

  for (const m of manifests) {
    const finance = m.workspaceFinance;
    if (finance === undefined) {
      continue;
    }
    const hasLedger = finance.ledgerPolicy !== undefined;
    const hasDefaults = finance.receiptDefaults !== undefined;
    if (!hasLedger && !hasDefaults) {
      continue;
    }
    if (hasLedger !== hasDefaults) {
      throw new Error(
        `workspace.manifest.json ${m.id}: workspaceFinance.ledgerPolicy and receiptDefaults must be declared together`
      );
    }
    const ledger = assertModuleExport(finance.ledgerPolicy, m.id, "ledgerPolicy");
    const defaults = assertModuleExport(finance.receiptDefaults, m.id, "receiptDefaults");
    const workspaceTypes = Array.isArray(m.workspaceTypes) ? m.workspaceTypes : [];
    if (workspaceTypes.length === 0) {
      throw new Error(`workspace.manifest.json ${m.id}: workspaceTypes required for finance dependency bindings`);
    }

    const safeId = m.id.replace(/[^a-zA-Z0-9]/g, "_");
    const ledgerAlias = `${safeId}_LedgerPolicy`;
    const defaultsAlias = `${safeId}_ReceiptDefaults`;
    const ledgerSpec = importSpecifier(m.package, ledger.module);
    const defaultsSpec = importSpecifier(m.package, defaults.module);
    if (ledgerSpec === defaultsSpec && ledger.export !== defaults.export) {
      importLines.push(
        `import {\n  ${ledger.export} as ${ledgerAlias},\n  ${defaults.export} as ${defaultsAlias},\n} from "${ledgerSpec}";`
      );
    } else if (ledgerSpec === defaultsSpec) {
      importLines.push(`import { ${ledger.export} as ${ledgerAlias} } from "${ledgerSpec}";`);
    } else {
      importLines.push(`import { ${ledger.export} as ${ledgerAlias} } from "${ledgerSpec}";`);
      importLines.push(`import { ${defaults.export} as ${defaultsAlias} } from "${defaultsSpec}";`);
    }

    for (const wt of workspaceTypes) {
      if (typeof wt !== "string" || wt.trim().length === 0) {
        throw new Error(`workspace.manifest.json ${m.id}: invalid workspaceType in finance dependency bindings`);
      }
      bindingEntries.push(`  ${JSON.stringify(wt.trim().toLowerCase())}: {
    createLedgerPolicy: () => new ${ledgerAlias}(),
    createReceiptDefaults: () => new ${defaultsAlias}(),
  },`);
    }
  }

  if (bindingEntries.length === 0) {
    return `${BANNER}
export const WORKSPACE_FINANCE_DEPENDENCY_BINDINGS = {} as const;

export function isFinanceDependencyBindingRegistered(_workspaceType: string): boolean {
  return false;
}

export function listFinanceDependencyWorkspaceTypes(): readonly string[] {
  return [];
}
`;
  }

  return `${BANNER}
${[...new Set(importLines)].join("\n\n")}

export const WORKSPACE_FINANCE_DEPENDENCY_BINDINGS = {
${bindingEntries.join("\n")}
} as const;

export function isFinanceDependencyBindingRegistered(workspaceType: string): boolean {
  return workspaceType.trim().toLowerCase() in WORKSPACE_FINANCE_DEPENDENCY_BINDINGS;
}

export function listFinanceDependencyWorkspaceTypes(): readonly string[] {
  return Object.keys(WORKSPACE_FINANCE_DEPENDENCY_BINDINGS).sort();
}
`;
}

/**
 * TourCreated finance event reaction adapter classes (Phase 1.10).
 * Platform injects Prisma host IO at resolve time.
 */
export function generateWorkspaceFinanceEventReactionBindings(manifests) {
  /** @type {string[]} */
  const importLines = [];
  /** @type {string[]} */
  const bindingEntries = [];

  for (const m of manifests) {
    const reaction = m.workspaceFinance?.eventReaction;
    if (reaction === undefined) {
      continue;
    }
    const declared = assertModuleExport(reaction, m.id, "eventReaction");
    const requiresHostIo = reaction.requiresHostIo === true;
    const workspaceTypes = Array.isArray(m.workspaceTypes) ? m.workspaceTypes : [];
    if (workspaceTypes.length === 0) {
      throw new Error(`workspace.manifest.json ${m.id}: workspaceTypes required for eventReaction`);
    }
    const safeId = m.id.replace(/[^a-zA-Z0-9]/g, "_");
    const alias = `${safeId}_EventReaction`;
    const spec = importSpecifier(m.package, declared.module);
    importLines.push(`import { ${declared.export} as ${alias} } from "${spec}";`);

    for (const wt of workspaceTypes) {
      if (typeof wt !== "string" || wt.trim().length === 0) {
        continue;
      }
      const key = JSON.stringify(wt.trim().toLowerCase());
      if (requiresHostIo) {
        bindingEntries.push(`  ${key}: {
    requiresHostIo: true as const,
    create: (hostIo: ConstructorParameters<typeof ${alias}>[0]) => new ${alias}(hostIo),
  },`);
      } else {
        bindingEntries.push(`  ${key}: {
    requiresHostIo: false as const,
    create: () => new ${alias}(),
  },`);
      }
    }
  }

  if (bindingEntries.length === 0) {
    return `${BANNER}
export const WORKSPACE_FINANCE_EVENT_REACTION_BINDINGS = {} as const;

export function isFinanceEventReactionBindingRegistered(_workspaceType: string): boolean {
  return false;
}
`;
  }

  return `${BANNER}
${[...new Set(importLines)].join("\n\n")}

export const WORKSPACE_FINANCE_EVENT_REACTION_BINDINGS = {
${bindingEntries.join("\n")}
} as const;

export function isFinanceEventReactionBindingRegistered(workspaceType: string): boolean {
  return workspaceType.trim().toLowerCase() in WORKSPACE_FINANCE_EVENT_REACTION_BINDINGS;
}
`;
}

/**
 * Chart of accounts constants — workspaceType → getAccounts() (Phase 1.10).
 * Required alongside ledgerPolicy/receiptDefaults when either is declared.
 */
export function generateWorkspaceFinanceChartOfAccountsBindings(manifests) {
  /** @type {string[]} */
  const importLines = [];
  /** @type {string[]} */
  const bindingEntries = [];

  for (const m of manifests) {
    const finance = m.workspaceFinance;
    if (finance === undefined) {
      continue;
    }
    const hasLedger = finance.ledgerPolicy !== undefined;
    const hasCoa = finance.chartOfAccounts !== undefined;
    if (!hasLedger && !hasCoa) {
      continue;
    }
    if (hasLedger && !hasCoa) {
      throw new Error(
        `workspace.manifest.json ${m.id}: workspaceFinance.chartOfAccounts required when ledgerPolicy is declared (Phase 1.10)`
      );
    }
    if (!hasLedger && hasCoa) {
      throw new Error(
        `workspace.manifest.json ${m.id}: workspaceFinance.chartOfAccounts requires ledgerPolicy + receiptDefaults`
      );
    }
    const coa = assertModuleExport(finance.chartOfAccounts, m.id, "chartOfAccounts");
    const workspaceTypes = Array.isArray(m.workspaceTypes) ? m.workspaceTypes : [];
    if (workspaceTypes.length === 0) {
      throw new Error(`workspace.manifest.json ${m.id}: workspaceTypes required for chartOfAccounts`);
    }
    const safeId = m.id.replace(/[^a-zA-Z0-9]/g, "_");
    const alias = `${safeId}_ChartOfAccounts`;
    const spec = importSpecifier(m.package, coa.module);
    importLines.push(`import { ${coa.export} as ${alias} } from "${spec}";`);
    for (const wt of workspaceTypes) {
      if (typeof wt !== "string" || wt.trim().length === 0) {
        continue;
      }
      bindingEntries.push(`  ${JSON.stringify(wt.trim().toLowerCase())}: {
    getAccounts: () => ${alias},
  },`);
    }
  }

  if (bindingEntries.length === 0) {
    return `${BANNER}
export const WORKSPACE_FINANCE_CHART_OF_ACCOUNTS_BINDINGS = {} as const;

export function isFinanceChartOfAccountsBindingRegistered(_workspaceType: string): boolean {
  return false;
}

export function listFinanceChartOfAccountsWorkspaceTypes(): readonly string[] {
  return [];
}
`;
  }

  return `${BANNER}
${[...new Set(importLines)].join("\n\n")}

export const WORKSPACE_FINANCE_CHART_OF_ACCOUNTS_BINDINGS = {
${bindingEntries.join("\n")}
} as const;

export function isFinanceChartOfAccountsBindingRegistered(workspaceType: string): boolean {
  return workspaceType.trim().toLowerCase() in WORKSPACE_FINANCE_CHART_OF_ACCOUNTS_BINDINGS;
}

export function listFinanceChartOfAccountsWorkspaceTypes(): readonly string[] {
  return Object.keys(WORKSPACE_FINANCE_CHART_OF_ACCOUNTS_BINDINGS).sort();
}
`;
}

