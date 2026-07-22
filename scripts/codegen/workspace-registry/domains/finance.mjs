import { BANNER } from "../constants.mjs";
import { importSpecifier } from "../utils.mjs";

/** @type {ReadonlySet<string>} */
const FINANCE_EVENT_REACTION_CAPABILITIES = new Set(["durable-outbox", "ack-only", "none"]);

/**
 * Finance B2.3 — `supported` is product enablement only; money guarantees live in capabilities.
 *
 * - ledgerCapture: HTTP payment/receipt → durable journals via FinanceService + CoA policy
 * - eventReactions: TourCreated reaction grade
 *   - durable-outbox: host IO, claim/idempotency, ledger side effects
 *   - ack-only: observable handler (returns true); no durable outbox/ledger claim
 *   - none: no TourCreated finance reaction
 * - ops: operator finance panels
 *
 * @param {object} m
 */
export function assertFinanceCapabilities(m) {
  const finance = m.workspaceFinance;
  if (finance === undefined || finance.supported !== true) {
    return;
  }
  const caps = finance.capabilities;
  if (caps === undefined || typeof caps !== "object") {
    throw new Error(
      `workspace.manifest.json ${m.id}: workspaceFinance.supported requires capabilities { ledgerCapture, eventReactions, ops }`
    );
  }
  if (typeof caps.ledgerCapture !== "boolean") {
    throw new Error(
      `workspace.manifest.json ${m.id}: workspaceFinance.capabilities.ledgerCapture must be boolean`
    );
  }
  if (!FINANCE_EVENT_REACTION_CAPABILITIES.has(caps.eventReactions)) {
    throw new Error(
      `workspace.manifest.json ${m.id}: workspaceFinance.capabilities.eventReactions must be durable-outbox|ack-only|none`
    );
  }
  if (typeof caps.ops !== "boolean") {
    throw new Error(
      `workspace.manifest.json ${m.id}: workspaceFinance.capabilities.ops must be boolean`
    );
  }

  if (caps.ledgerCapture === true) {
    if (finance.ledgerPolicy === undefined || finance.receiptDefaults === undefined) {
      throw new Error(
        `workspace.manifest.json ${m.id}: capabilities.ledgerCapture=true requires ledgerPolicy and receiptDefaults`
      );
    }
    if (finance.chartOfAccounts === undefined) {
      throw new Error(
        `workspace.manifest.json ${m.id}: capabilities.ledgerCapture=true requires chartOfAccounts`
      );
    }
  } else if (
    finance.ledgerPolicy !== undefined ||
    finance.receiptDefaults !== undefined ||
    finance.chartOfAccounts !== undefined
  ) {
    throw new Error(
      `workspace.manifest.json ${m.id}: ledgerPolicy/receiptDefaults/chartOfAccounts require capabilities.ledgerCapture=true`
    );
  }

  const reaction = finance.eventReaction;
  const requiresHostIo = reaction?.requiresHostIo === true;
  if (caps.eventReactions === "durable-outbox") {
    if (reaction === undefined) {
      throw new Error(
        `workspace.manifest.json ${m.id}: capabilities.eventReactions=durable-outbox requires eventReaction`
      );
    }
    if (!requiresHostIo) {
      throw new Error(
        `workspace.manifest.json ${m.id}: capabilities.eventReactions=durable-outbox requires eventReaction.requiresHostIo=true`
      );
    }
  } else if (caps.eventReactions === "ack-only") {
    if (reaction === undefined) {
      throw new Error(
        `workspace.manifest.json ${m.id}: capabilities.eventReactions=ack-only requires eventReaction`
      );
    }
    if (requiresHostIo) {
      throw new Error(
        `workspace.manifest.json ${m.id}: capabilities.eventReactions=ack-only forbids eventReaction.requiresHostIo=true (would hide weaker money path)`
      );
    }
  } else if (reaction !== undefined) {
    throw new Error(
      `workspace.manifest.json ${m.id}: eventReaction declared but capabilities.eventReactions=none`
    );
  }

  if (caps.ops === true) {
    if (finance.opsManifest === undefined) {
      throw new Error(
        `workspace.manifest.json ${m.id}: capabilities.ops=true requires opsManifest`
      );
    }
  } else if (finance.opsManifest !== undefined) {
    throw new Error(
      `workspace.manifest.json ${m.id}: opsManifest requires capabilities.ops=true`
    );
  }
}

/**
 * Explicit capability matrix for supported finance workspaces (Finance B2.3).
 * `supported` alone must not be read as Denali-equivalent TourCreated money semantics.
 */
export function generateWorkspaceFinanceCapabilities(manifests) {
  /** @type {string[]} */
  const capabilityEntries = [];

  for (const m of manifests) {
    const finance = m.workspaceFinance;
    if (finance === undefined || finance.supported !== true) {
      continue;
    }
    assertFinanceCapabilities(m);
    const tw = m.tourWrite;
    if (tw === undefined || typeof tw.workspaceTypeExport !== "string") {
      throw new Error(
        `workspace.manifest.json ${m.id}: workspaceFinance.supported requires tourWrite.workspaceTypeExport`
      );
    }
    const workspaceTypes = Array.isArray(m.workspaceTypes) ? m.workspaceTypes : [];
    if (workspaceTypes.length === 0) {
      throw new Error(
        `workspace.manifest.json ${m.id}: workspaceTypes required for finance capabilities`
      );
    }
    const caps = finance.capabilities;
    for (const wt of workspaceTypes) {
      if (typeof wt !== "string" || wt.trim().length === 0) {
        continue;
      }
      capabilityEntries.push(`  ${JSON.stringify(wt.trim().toLowerCase())}: {
    supported: true as const,
    ledgerCapture: ${caps.ledgerCapture === true ? "true" : "false"} as const,
    eventReactions: ${JSON.stringify(caps.eventReactions)} as const,
    ops: ${caps.ops === true ? "true" : "false"} as const,
  },`);
    }
  }

  if (capabilityEntries.length === 0) {
    return `${BANNER}
export type FinanceEventReactionCapability = "durable-outbox" | "ack-only" | "none";

export type FinanceWorkspaceCapabilities = {
  readonly supported: true;
  readonly ledgerCapture: boolean;
  readonly eventReactions: FinanceEventReactionCapability;
  readonly ops: boolean;
};

export const WORKSPACE_FINANCE_CAPABILITIES = {} as const;

export function getFinanceWorkspaceCapabilities(
  _workspaceType: string
): FinanceWorkspaceCapabilities | null {
  return null;
}

export function listFinanceCapableWorkspaceTypes(): readonly string[] {
  return [];
}

export function financeWorkspaceHasCapability(
  _workspaceType: string,
  _capability: "ledgerCapture" | "ops"
): boolean {
  return false;
}

export function financeWorkspaceEventReactionCapability(
  _workspaceType: string
): FinanceEventReactionCapability | null {
  return null;
}
`;
  }

  return `${BANNER}
export type FinanceEventReactionCapability = "durable-outbox" | "ack-only" | "none";

export type FinanceWorkspaceCapabilities = {
  readonly supported: true;
  readonly ledgerCapture: boolean;
  readonly eventReactions: FinanceEventReactionCapability;
  readonly ops: boolean;
};

/**
 * Capability matrix — product gate (\`supported\`) vs money-path grades.
 * Keys are literal workspaceType strings from workspace.manifest.json (P4-D3.d — no product package imports).
 * Denali: durable-outbox TourCreated. finance-ws5: ack-only TourCreated.
 * Both may claim ledgerCapture for HTTP receipt/payment journals.
 */
export const WORKSPACE_FINANCE_CAPABILITIES = {
${capabilityEntries.join("\n")}
} as const satisfies Record<string, FinanceWorkspaceCapabilities>;

export function getFinanceWorkspaceCapabilities(
  workspaceType: string
): FinanceWorkspaceCapabilities | null {
  const key = workspaceType.trim().toLowerCase();
  if (key.length === 0) {
    return null;
  }
  const caps = (WORKSPACE_FINANCE_CAPABILITIES as Record<string, FinanceWorkspaceCapabilities>)[key];
  return caps ?? null;
}

export function listFinanceCapableWorkspaceTypes(): readonly string[] {
  return Object.keys(WORKSPACE_FINANCE_CAPABILITIES).sort();
}

export function financeWorkspaceHasCapability(
  workspaceType: string,
  capability: "ledgerCapture" | "ops"
): boolean {
  const caps = getFinanceWorkspaceCapabilities(workspaceType);
  if (caps === null) {
    return false;
  }
  return caps[capability] === true;
}

export function financeWorkspaceEventReactionCapability(
  workspaceType: string
): FinanceEventReactionCapability | null {
  return getFinanceWorkspaceCapabilities(workspaceType)?.eventReactions ?? null;
}
`;
}

export function generateWorkspaceFinanceBindings(manifests) {
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
    assertFinanceCapabilities(m);
    if (finance.ledgerPolicy === undefined || finance.receiptDefaults === undefined) {
      throw new Error(
        `workspace.manifest.json ${m.id}: workspaceFinance.supported requires ledgerPolicy and receiptDefaults (Phase 1.10)`
      );
    }
    if (finance.chartOfAccounts === undefined) {
      throw new Error(
        `workspace.manifest.json ${m.id}: workspaceFinance.supported requires chartOfAccounts`
      );
    }
    if (finance.eventReaction === undefined) {
      throw new Error(
        `workspace.manifest.json ${m.id}: workspaceFinance.supported requires eventReaction (capability-graded TourCreated)`
      );
    }
    if (finance.opsManifest === undefined) {
      throw new Error(
        `workspace.manifest.json ${m.id}: workspaceFinance.supported requires opsManifest`
      );
    }
    const tw = m.tourWrite;
    if (tw === undefined || typeof tw.workspaceTypeExport !== "string") {
      throw new Error(
        `workspace.manifest.json ${m.id}: workspaceFinance.supported requires tourWrite.workspaceTypeExport`
      );
    }
    const workspaceTypes = Array.isArray(m.workspaceTypes) ? m.workspaceTypes : [];
    if (workspaceTypes.length === 0) {
      throw new Error(
        `workspace.manifest.json ${m.id}: workspaceTypes required for finance bindings`
      );
    }
    const defaultField =
      finance.defaultModuleEnabledWhenUnset === true
        ? `\n    defaultModuleEnabledWhenUnset: true as const,`
        : "";
    for (const wt of workspaceTypes) {
      if (typeof wt !== "string" || wt.trim().length === 0) {
        continue;
      }
      bindingBlocks.push(`  {
    workspaceType: ${JSON.stringify(wt.trim().toLowerCase())},${defaultField}
  },`);
    }
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
  return supportedWorkspaceTypes.has(workspaceType.trim().toLowerCase());
}

export function isFinanceDefaultEnabledWhenModulesUnset(workspaceType: string): boolean {
  return defaultEnabledWhenUnset.has(workspaceType.trim().toLowerCase());
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
 * Web finance ops panel defaults — pluginId → workspace ops manifest (Phase 1.9.2 / P4-D3.c).
 * Dynamic import only — generic apps/web must never statically import workspace packages.
 */
export function generateWorkspaceFinanceOpsBindings(manifests) {
  /** @type {string[]} */
  const bindingEntries = [];

  for (const m of manifests) {
    const finance = m.workspaceFinance;
    if (finance === undefined || finance.supported !== true) {
      continue;
    }
    const ops = finance.opsManifest;
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
    bindingEntries.push(`  ${JSON.stringify(m.id)}: {
    loadManifest: async (theme: unknown = null) => {
      const mod = await import(${JSON.stringify(spec)});
      if (theme === null || theme === undefined) {
        return mod.${ops.defaultExport};
      }
      return mod.${ops.resolveFromThemeExport}(theme);
    },
  },`);
  }

  if (bindingEntries.length === 0) {
    return `${BANNER}
import type { FinanceOpsCapability } from "@/finance/finance-ops-capability-contract";

export const WORKSPACE_FINANCE_OPS_PLUGIN_IDS = new Set<string>([]);

export function hasFinanceOpsManifest(_pluginId: string): boolean {
  return false;
}

export async function resolveWorkspaceFinanceOpsManifest(
  pluginId: string,
  _theme: unknown = null
): Promise<FinanceOpsCapability> {
  throw new Error(\`Finance ops capability not registered for pluginId=\${pluginId}\`);
}
`;
  }

  return `${BANNER}
import type { FinanceOpsCapability } from "@/finance/finance-ops-capability-contract";

export const WORKSPACE_FINANCE_OPS_BINDINGS = {
${bindingEntries.join("\n")}
} as const;

export const WORKSPACE_FINANCE_OPS_PLUGIN_IDS = new Set<string>(
  Object.keys(WORKSPACE_FINANCE_OPS_BINDINGS)
);

export function hasFinanceOpsManifest(pluginId: string): boolean {
  return pluginId in WORKSPACE_FINANCE_OPS_BINDINGS;
}

export async function resolveWorkspaceFinanceOpsManifest(
  pluginId: string,
  theme: unknown = null
): Promise<FinanceOpsCapability> {
  const binding = WORKSPACE_FINANCE_OPS_BINDINGS[pluginId as keyof typeof WORKSPACE_FINANCE_OPS_BINDINGS];
  if (binding === undefined) {
    throw new Error(\`Finance ops capability not registered for pluginId=\${pluginId}\`);
  }
  return binding.loadManifest(theme);
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
 * API finance dependency factories — workspaceType → ledger + receipt defaults (Phase 1.10 / P4-D3.b).
 * Dynamic import only — no static product package imports (API cold-start).
 * Booking projection stays platform-owned (not generated).
 */
export function generateWorkspaceFinanceDependencyBindings(manifests) {
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

    const ledgerSpec = importSpecifier(m.package, ledger.module);
    const defaultsSpec = importSpecifier(m.package, defaults.module);

    for (const wt of workspaceTypes) {
      if (typeof wt !== "string" || wt.trim().length === 0) {
        throw new Error(`workspace.manifest.json ${m.id}: invalid workspaceType in finance dependency bindings`);
      }
      bindingEntries.push(`  ${JSON.stringify(wt.trim().toLowerCase())}: {
    createLedgerPolicy: async () => {
      const mod = await import(${JSON.stringify(ledgerSpec)});
      return new mod.${ledger.export}();
    },
    createReceiptDefaults: async () => {
      const mod = await import(${JSON.stringify(defaultsSpec)});
      return new mod.${defaults.export}();
    },
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
 * TourCreated finance event reaction adapter classes (Phase 1.10 / P4-D3.b).
 * Dynamic import only — platform injects Prisma host IO at resolve time.
 */
export function generateWorkspaceFinanceEventReactionBindings(manifests) {
  /** @type {string[]} */
  const bindingEntries = [];

  for (const m of manifests) {
    if (m.workspaceFinance?.supported === true) {
      assertFinanceCapabilities(m);
    }
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
    const spec = importSpecifier(m.package, declared.module);

    for (const wt of workspaceTypes) {
      if (typeof wt !== "string" || wt.trim().length === 0) {
        continue;
      }
      const key = JSON.stringify(wt.trim().toLowerCase());
      if (requiresHostIo) {
        bindingEntries.push(`  ${key}: {
    requiresHostIo: true as const,
    create: async (hostIo: unknown) => {
      const mod = await import(${JSON.stringify(spec)});
      return new mod.${declared.export}(hostIo as never);
    },
  },`);
      } else {
        bindingEntries.push(`  ${key}: {
    requiresHostIo: false as const,
    create: async () => {
      const mod = await import(${JSON.stringify(spec)});
      return new mod.${declared.export}();
    },
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
export const WORKSPACE_FINANCE_EVENT_REACTION_BINDINGS = {
${bindingEntries.join("\n")}
} as const;

export function isFinanceEventReactionBindingRegistered(workspaceType: string): boolean {
  return workspaceType.trim().toLowerCase() in WORKSPACE_FINANCE_EVENT_REACTION_BINDINGS;
}
`;
}

/**
 * Chart of accounts constants — workspaceType → loadAccounts() (Phase 1.10 / P4-D3.a).
 * Dynamic import only — no static product package imports (API cold-start).
 * Required alongside ledgerPolicy/receiptDefaults when either is declared.
 */
export function generateWorkspaceFinanceChartOfAccountsBindings(manifests) {
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
    const spec = importSpecifier(m.package, coa.module);
    for (const wt of workspaceTypes) {
      if (typeof wt !== "string" || wt.trim().length === 0) {
        continue;
      }
      bindingEntries.push(`  ${JSON.stringify(wt.trim().toLowerCase())}: {
    loadAccounts: async () => {
      const mod = await import(${JSON.stringify(spec)});
      return mod.${coa.export};
    },
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

/**
 * API finance registration-obligation resolvers (P3.5 / FC-2 / P4-D3.b).
 * Dynamic import only — pure pricing binds; host adapter stays DI-neutral.
 */
export function generateWorkspaceFinanceObligationBindings(manifests) {
  /** @type {string[]} */
  const bindingEntries = [];

  for (const m of manifests) {
    const finance = m.workspaceFinance;
    if (finance === undefined || finance.registrationObligation === undefined) {
      continue;
    }
    const obligation = assertModuleExport(
      finance.registrationObligation,
      m.id,
      "registrationObligation"
    );
    const workspaceTypes = Array.isArray(m.workspaceTypes) ? m.workspaceTypes : [];
    if (workspaceTypes.length === 0) {
      throw new Error(
        `workspace.manifest.json ${m.id}: workspaceTypes required for registrationObligation`
      );
    }
    const spec = importSpecifier(m.package, obligation.module);
    for (const wt of workspaceTypes) {
      if (typeof wt !== "string" || wt.trim().length === 0) {
        continue;
      }
      bindingEntries.push(`  ${JSON.stringify(wt.trim().toLowerCase())}: {
    loadResolve: async () => {
      const mod = await import(${JSON.stringify(spec)});
      return mod.${obligation.export};
    },
  },`);
    }
  }

  if (bindingEntries.length === 0) {
    return `${BANNER}
export const WORKSPACE_FINANCE_OBLIGATION_BINDINGS = {} as const;

export function isFinanceObligationBindingRegistered(_workspaceType: string): boolean {
  return false;
}

export function listFinanceObligationWorkspaceTypes(): readonly string[] {
  return [];
}
`;
  }

  return `${BANNER}
export const WORKSPACE_FINANCE_OBLIGATION_BINDINGS = {
${bindingEntries.join("\n")}
} as const;

export function isFinanceObligationBindingRegistered(workspaceType: string): boolean {
  return workspaceType.trim().toLowerCase() in WORKSPACE_FINANCE_OBLIGATION_BINDINGS;
}

export function listFinanceObligationWorkspaceTypes(): readonly string[] {
  return Object.keys(WORKSPACE_FINANCE_OBLIGATION_BINDINGS).sort();
}
`;
}

