import { BANNER } from "../constants.mjs";

function tsObjectKey(value) {
  return /^[A-Za-z_$][\w$]*$/.test(value) ? value : JSON.stringify(value);
}

/**
 * WALLET-P1 — `supported` is product enablement only; capability flags are graded honesty.
 *
 * @param {object} m
 */
export function assertWalletCapabilities(m) {
  const wallet = m.workspaceWallet;
  if (wallet === undefined || wallet.supported !== true) {
    return;
  }
  const caps = wallet.capabilities;
  if (caps === undefined || typeof caps !== "object" || caps === null) {
    throw new Error(
      `workspace.manifest.json ${m.id}: workspaceWallet.supported requires capabilities { memberAccounts, ops }`
    );
  }
  if (typeof caps.memberAccounts !== "boolean") {
    throw new Error(
      `workspace.manifest.json ${m.id}: workspaceWallet.capabilities.memberAccounts must be boolean`
    );
  }
  if (typeof caps.ops !== "boolean") {
    throw new Error(
      `workspace.manifest.json ${m.id}: workspaceWallet.capabilities.ops must be boolean`
    );
  }
  if (caps.gatewayTopUp !== undefined && typeof caps.gatewayTopUp !== "boolean") {
    throw new Error(
      `workspace.manifest.json ${m.id}: workspaceWallet.capabilities.gatewayTopUp must be boolean when declared`
    );
  }
  if (caps.withdrawals !== undefined && typeof caps.withdrawals !== "boolean") {
    throw new Error(
      `workspace.manifest.json ${m.id}: workspaceWallet.capabilities.withdrawals must be boolean when declared`
    );
  }

  if (caps.ops === true && wallet.opsManifest === undefined) {
    throw new Error(
      `workspace.manifest.json ${m.id}: capabilities.ops=true requires opsManifest`
    );
  }
  if (caps.ops !== true && wallet.opsManifest !== undefined) {
    throw new Error(
      `workspace.manifest.json ${m.id}: opsManifest requires capabilities.ops=true`
    );
  }

  if (caps.memberAccounts === true && wallet.ledgerPolicy === undefined) {
    throw new Error(
      `workspace.manifest.json ${m.id}: capabilities.memberAccounts=true requires ledgerPolicy`
    );
  }
  if (caps.memberAccounts !== true && wallet.ledgerPolicy !== undefined) {
    throw new Error(
      `workspace.manifest.json ${m.id}: ledgerPolicy requires capabilities.memberAccounts=true`
    );
  }

  if (caps.withdrawals === true && wallet.operatorPolicy === undefined) {
    throw new Error(
      `workspace.manifest.json ${m.id}: capabilities.withdrawals=true requires operatorPolicy`
    );
  }
  if (caps.withdrawals !== true && wallet.operatorPolicy !== undefined) {
    throw new Error(
      `workspace.manifest.json ${m.id}: operatorPolicy requires capabilities.withdrawals=true`
    );
  }
}

/**
 * @param {Record<string, unknown>} manifest
 */
export function assertWorkspaceWalletManifest(manifest) {
  const wallet = manifest.workspaceWallet;
  if (wallet === undefined) {
    return;
  }
  if (typeof wallet !== "object" || wallet === null || Array.isArray(wallet)) {
    throw new Error(`workspace.manifest.json ${manifest.id}: workspaceWallet must be an object`);
  }
  if (typeof wallet.supported !== "boolean") {
    throw new Error(`workspace.manifest.json ${manifest.id}: workspaceWallet.supported must be boolean`);
  }
  if (wallet.supported === true) {
    assertWalletCapabilities(manifest);
  }
}

/**
 * SDK catalog — workspace wallet capability matrix (equipment pattern).
 *
 * @param {readonly Record<string, unknown>[]} manifests
 */
export function generateWorkspaceWalletCapabilities(manifests) {
  /** @type {string[]} */
  const capabilityEntries = [];

  for (const m of manifests) {
    const wallet = m.workspaceWallet;
    if (wallet === undefined || wallet.supported !== true) {
      continue;
    }
    assertWalletCapabilities(m);
    const workspaceTypes = Array.isArray(m.workspaceTypes) ? m.workspaceTypes : [];
    if (workspaceTypes.length === 0) {
      throw new Error(
        `workspace.manifest.json ${m.id}: workspaceTypes required for wallet capabilities`
      );
    }
    const caps = wallet.capabilities;
    for (const wt of workspaceTypes) {
      if (typeof wt !== "string" || wt.trim().length === 0) {
        continue;
      }
      capabilityEntries.push(`  ${JSON.stringify(wt.trim().toLowerCase())}: {
    supported: true as const,
    defaultModuleEnabledWhenUnset: ${wallet.defaultModuleEnabledWhenUnset === true ? "true" : "false"} as const,
    memberAccounts: ${caps.memberAccounts === true ? "true" : "false"} as const,
    ops: ${caps.ops === true ? "true" : "false"} as const,
    gatewayTopUp: ${caps.gatewayTopUp === true ? "true" : "false"} as const,
    withdrawals: ${caps.withdrawals === true ? "true" : "false"} as const,
  },`);
    }
  }

  if (capabilityEntries.length === 0) {
    return `${BANNER}
export type WorkspaceWalletCapabilities = {
  readonly supported: true;
  readonly defaultModuleEnabledWhenUnset: boolean;
  readonly memberAccounts: boolean;
  readonly ops: boolean;
  readonly gatewayTopUp: boolean;
  readonly withdrawals: boolean;
};

export const WORKSPACE_WALLET_CAPABILITIES = {} as const;

export function getWorkspaceWalletCapabilities(
  _workspaceType: string
): WorkspaceWalletCapabilities | null {
  return null;
}

export function listWalletCapableWorkspaceTypes(): readonly string[] {
  return [];
}

export function walletWorkspaceHasCapability(
  _workspaceType: string,
  _capability: "memberAccounts" | "ops" | "gatewayTopUp" | "withdrawals"
): boolean {
  return false;
}
`;
  }

  return `${BANNER}
export type WorkspaceWalletCapabilities = {
  readonly supported: true;
  readonly defaultModuleEnabledWhenUnset: boolean;
  readonly memberAccounts: boolean;
  readonly ops: boolean;
  readonly gatewayTopUp: boolean;
  readonly withdrawals: boolean;
};

/**
 * Capability matrix — product gate (\`supported\`) vs wallet surface flags.
 * Keys are literal workspaceType strings from workspace.manifest.json.
 */
export const WORKSPACE_WALLET_CAPABILITIES = {
${capabilityEntries.join("\n")}
} as const satisfies Record<string, WorkspaceWalletCapabilities>;

export function getWorkspaceWalletCapabilities(
  workspaceType: string
): WorkspaceWalletCapabilities | null {
  const key = workspaceType.trim().toLowerCase();
  if (key.length === 0) {
    return null;
  }
  const caps = (WORKSPACE_WALLET_CAPABILITIES as Record<string, WorkspaceWalletCapabilities>)[key];
  return caps ?? null;
}

export function listWalletCapableWorkspaceTypes(): readonly string[] {
  return Object.keys(WORKSPACE_WALLET_CAPABILITIES).sort();
}

export function walletWorkspaceHasCapability(
  workspaceType: string,
  capability: "memberAccounts" | "ops" | "gatewayTopUp" | "withdrawals"
): boolean {
  const caps = getWorkspaceWalletCapabilities(workspaceType);
  if (caps === null) {
    return false;
  }
  return caps[capability] === true;
}
`;
}

/**
 * API enablement bindings — finance workspaceFinance mirror.
 *
 * @param {readonly Record<string, unknown>[]} manifests
 */
export function generateWorkspaceWalletBindings(manifests) {
  /** @type {string[]} */
  const bindingBlocks = [];

  for (const m of manifests) {
    const wallet = m.workspaceWallet;
    if (wallet === undefined || wallet.supported !== true) {
      continue;
    }
    assertWalletCapabilities(m);
    const workspaceTypes = Array.isArray(m.workspaceTypes) ? m.workspaceTypes : [];
    if (workspaceTypes.length === 0) {
      throw new Error(`workspace.manifest.json ${m.id}: workspaceTypes required for wallet bindings`);
    }
    const defaultField =
      wallet.defaultModuleEnabledWhenUnset === true
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
export const WORKSPACE_WALLET_BINDINGS = [] as const;

export function isWalletSupportedWorkspace(_workspaceType: string): boolean {
  return false;
}

export function isWalletDefaultEnabledWhenModulesUnset(_workspaceType: string): boolean {
  return false;
}
`;
  }

  return `${BANNER}
export const WORKSPACE_WALLET_BINDINGS = [
${bindingBlocks.join("\n")}
] as const;

const supportedWorkspaceTypes = new Set(
  WORKSPACE_WALLET_BINDINGS.map((binding) => binding.workspaceType as string)
);

const defaultEnabledWhenUnset = new Set(
  WORKSPACE_WALLET_BINDINGS.filter(
    (binding) => "defaultModuleEnabledWhenUnset" in binding && binding.defaultModuleEnabledWhenUnset === true
  ).map((binding) => binding.workspaceType as string)
);

export function isWalletSupportedWorkspace(workspaceType: string): boolean {
  return supportedWorkspaceTypes.has(workspaceType.trim().toLowerCase());
}

export function isWalletDefaultEnabledWhenModulesUnset(workspaceType: string): boolean {
  return defaultEnabledWhenUnset.has(workspaceType.trim().toLowerCase());
}
`;
}
