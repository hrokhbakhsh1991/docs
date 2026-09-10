import { BANNER } from "../constants.mjs";

/**
 * @param {object} m
 */
export function assertMarketingPagesCapabilities(m) {
  const pages = m.workspaceMarketingPages;
  if (pages === undefined || pages.supported !== true) {
    return;
  }
  const caps = pages.capabilities;
  if (caps === undefined || typeof caps !== "object" || caps === null) {
    throw new Error(
      `workspace.manifest.json ${m.id}: workspaceMarketingPages.supported requires capabilities { operatorEditor }`,
    );
  }
  if (typeof caps.operatorEditor !== "boolean") {
    throw new Error(
      `workspace.manifest.json ${m.id}: workspaceMarketingPages.capabilities.operatorEditor must be boolean`,
    );
  }
  const allowed = pages.allowedPageKeys;
  if (!Array.isArray(allowed) || allowed.length === 0) {
    throw new Error(
      `workspace.manifest.json ${m.id}: workspaceMarketingPages.allowedPageKeys must be a non-empty array`,
    );
  }
}

/**
 * @param {Record<string, unknown>} manifest
 */
export function assertWorkspaceMarketingPagesManifest(manifest) {
  const pages = manifest.workspaceMarketingPages;
  if (pages === undefined) {
    return;
  }
  if (typeof pages !== "object" || pages === null || Array.isArray(pages)) {
    throw new Error(
      `workspace.manifest.json ${manifest.id}: workspaceMarketingPages must be an object`,
    );
  }
  if (typeof pages.supported !== "boolean") {
    throw new Error(
      `workspace.manifest.json ${manifest.id}: workspaceMarketingPages.supported must be boolean`,
    );
  }
  if (pages.supported === true) {
    assertMarketingPagesCapabilities(manifest);
  }
}

/**
 * @param {readonly Record<string, unknown>[]} manifests
 */
export function generateWorkspaceMarketingPagesCapabilities(manifests) {
  /** @type {string[]} */
  const capabilityEntries = [];

  for (const m of manifests) {
    const pages = m.workspaceMarketingPages;
    if (pages === undefined || pages.supported !== true) {
      continue;
    }
    assertMarketingPagesCapabilities(m);
    const workspaceTypes = Array.isArray(m.workspaceTypes) ? m.workspaceTypes : [];
    if (workspaceTypes.length === 0) {
      throw new Error(
        `workspace.manifest.json ${m.id}: workspaceTypes required for marketing pages capabilities`,
      );
    }
    const caps = pages.capabilities;
    const allowedPageKeys = pages.allowedPageKeys;
    for (const wt of workspaceTypes) {
      if (typeof wt !== "string" || wt.trim().length === 0) {
        continue;
      }
      capabilityEntries.push(`  ${JSON.stringify(wt.trim().toLowerCase())}: {
    supported: true as const,
    defaultModuleEnabledWhenUnset: ${pages.defaultModuleEnabledWhenUnset === true ? "true" : "false"} as const,
    operatorEditor: ${caps.operatorEditor === true ? "true" : "false"} as const,
    allowedPageKeys: Object.freeze(${JSON.stringify(allowedPageKeys)}),
  },`);
    }
  }

  if (capabilityEntries.length === 0) {
    return `${BANNER}
export type WorkspaceMarketingPagesCapabilities = {
  readonly supported: true;
  readonly defaultModuleEnabledWhenUnset: boolean;
  readonly operatorEditor: boolean;
  readonly allowedPageKeys: readonly string[];
};

export const WORKSPACE_MARKETING_PAGES_CAPABILITIES = {} as const;

export function getWorkspaceMarketingPagesCapabilities(
  _workspaceType: string,
): WorkspaceMarketingPagesCapabilities | null {
  return null;
}
`;
  }

  return `${BANNER}
export type WorkspaceMarketingPagesCapabilities = {
  readonly supported: true;
  readonly defaultModuleEnabledWhenUnset: boolean;
  readonly operatorEditor: boolean;
  readonly allowedPageKeys: readonly string[];
};

export const WORKSPACE_MARKETING_PAGES_CAPABILITIES = {
${capabilityEntries.join("\n")}
} as const;

export function getWorkspaceMarketingPagesCapabilities(
  workspaceType: string,
): WorkspaceMarketingPagesCapabilities | null {
  const key = workspaceType.trim().toLowerCase();
  return (WORKSPACE_MARKETING_PAGES_CAPABILITIES as Record<string, WorkspaceMarketingPagesCapabilities>)[key] ?? null;
}
`;
}

/**
 * @param {readonly Record<string, unknown>[]} manifests
 */
export function generateWorkspaceMarketingPagesBindings(manifests) {
  /** @type {string[]} */
  const bindingBlocks = [];

  for (const m of manifests) {
    const pages = m.workspaceMarketingPages;
    if (pages === undefined || pages.supported !== true) {
      continue;
    }
    assertMarketingPagesCapabilities(m);
    const workspaceTypes = Array.isArray(m.workspaceTypes) ? m.workspaceTypes : [];
    const allowedPageKeys = pages.allowedPageKeys;
    for (const wt of workspaceTypes) {
      if (typeof wt !== "string" || wt.trim().length === 0) {
        continue;
      }
      bindingBlocks.push(`  {
    workspaceType: ${JSON.stringify(wt.trim().toLowerCase())},
    allowedPageKeys: Object.freeze(${JSON.stringify(allowedPageKeys)}),
    defaultModuleEnabledWhenUnset: ${pages.defaultModuleEnabledWhenUnset === true ? "true" : "false"},
  },`);
    }
  }

  if (bindingBlocks.length === 0) {
    return `${BANNER}
export const WORKSPACE_MARKETING_PAGES_BINDINGS = [] as const;

export function isMarketingPagesSupportedWorkspace(_workspaceType: string): boolean {
  return false;
}

export function resolveMarketingPagesAllowedKeys(_workspaceType: string): readonly string[] {
  return [];
}

export function isMarketingPagesDefaultEnabledWhenModulesUnset(_workspaceType: string): boolean {
  return false;
}
`;
  }

  return `${BANNER}
export const WORKSPACE_MARKETING_PAGES_BINDINGS = [
${bindingBlocks.join("\n")}
] as const;

const bindingsByWorkspace = new Map(
  WORKSPACE_MARKETING_PAGES_BINDINGS.map((binding) => [binding.workspaceType as string, binding]),
);

const defaultEnabledWhenUnset = new Set(
  WORKSPACE_MARKETING_PAGES_BINDINGS.filter(
    (binding) => binding.defaultModuleEnabledWhenUnset === true,
  ).map((binding) => binding.workspaceType as string),
);

export function isMarketingPagesSupportedWorkspace(workspaceType: string): boolean {
  return bindingsByWorkspace.has(workspaceType.trim().toLowerCase());
}

export function resolveMarketingPagesAllowedKeys(workspaceType: string): readonly string[] {
  const binding = bindingsByWorkspace.get(workspaceType.trim().toLowerCase());
  return binding?.allowedPageKeys ?? [];
}

export function isMarketingPagesDefaultEnabledWhenModulesUnset(workspaceType: string): boolean {
  return defaultEnabledWhenUnset.has(workspaceType.trim().toLowerCase());
}
`;
}
