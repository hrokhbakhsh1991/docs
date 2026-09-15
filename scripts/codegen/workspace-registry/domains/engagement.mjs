import { BANNER } from "../constants.mjs";

/**
 * @param {object} m
 */
export function assertEngagementCapabilities(m) {
  const engagement = m.workspaceEngagement;
  if (engagement === undefined || engagement.supported !== true) {
    return;
  }
  const caps = engagement.capabilities;
  if (caps === undefined || typeof caps !== "object" || caps === null) {
    throw new Error(
      `workspace.manifest.json ${m.id}: workspaceEngagement.supported requires capabilities { memberDashboard, operatorOverview }`,
    );
  }
  if (typeof caps.memberDashboard !== "boolean") {
    throw new Error(
      `workspace.manifest.json ${m.id}: workspaceEngagement.capabilities.memberDashboard must be boolean`,
    );
  }
  if (typeof caps.operatorOverview !== "boolean") {
    throw new Error(
      `workspace.manifest.json ${m.id}: workspaceEngagement.capabilities.operatorOverview must be boolean`,
    );
  }
}

/**
 * @param {Record<string, unknown>} manifest
 */
export function assertWorkspaceEngagementManifest(manifest) {
  const engagement = manifest.workspaceEngagement;
  if (engagement === undefined) {
    return;
  }
  if (typeof engagement !== "object" || engagement === null || Array.isArray(engagement)) {
    throw new Error(
      `workspace.manifest.json ${manifest.id}: workspaceEngagement must be an object`,
    );
  }
  if (typeof engagement.supported !== "boolean") {
    throw new Error(
      `workspace.manifest.json ${manifest.id}: workspaceEngagement.supported must be boolean`,
    );
  }
  if (engagement.supported === true) {
    assertEngagementCapabilities(manifest);
  }
}

/**
 * @param {readonly Record<string, unknown>[]} manifests
 */
export function generateWorkspaceEngagementCapabilities(manifests) {
  /** @type {string[]} */
  const capabilityEntries = [];

  for (const m of manifests) {
    const engagement = m.workspaceEngagement;
    if (engagement === undefined || engagement.supported !== true) {
      continue;
    }
    assertEngagementCapabilities(m);
    const workspaceTypes = Array.isArray(m.workspaceTypes) ? m.workspaceTypes : [];
    if (workspaceTypes.length === 0) {
      throw new Error(
        `workspace.manifest.json ${m.id}: workspaceTypes required for engagement capabilities`,
      );
    }
    const caps = engagement.capabilities;
    for (const wt of workspaceTypes) {
      if (typeof wt !== "string" || wt.trim().length === 0) {
        continue;
      }
      capabilityEntries.push(`  ${JSON.stringify(wt.trim().toLowerCase())}: {
    supported: true as const,
    defaultModuleEnabledWhenUnset: ${engagement.defaultModuleEnabledWhenUnset === true ? "true" : "false"} as const,
    memberDashboard: ${caps.memberDashboard === true ? "true" : "false"} as const,
    operatorOverview: ${caps.operatorOverview === true ? "true" : "false"} as const,
  },`);
    }
  }

  if (capabilityEntries.length === 0) {
    return `${BANNER}
export type WorkspaceEngagementCapabilities = {
  readonly supported: true;
  readonly defaultModuleEnabledWhenUnset: boolean;
  readonly memberDashboard: boolean;
  readonly operatorOverview: boolean;
};

export const WORKSPACE_ENGAGEMENT_CAPABILITIES = {} as const;

export function getWorkspaceEngagementCapabilities(
  _workspaceType: string,
): WorkspaceEngagementCapabilities | null {
  return null;
}
`;
  }

  return `${BANNER}
export type WorkspaceEngagementCapabilities = {
  readonly supported: true;
  readonly defaultModuleEnabledWhenUnset: boolean;
  readonly memberDashboard: boolean;
  readonly operatorOverview: boolean;
};

export const WORKSPACE_ENGAGEMENT_CAPABILITIES = {
${capabilityEntries.join("\n")}
} as const;

export function getWorkspaceEngagementCapabilities(
  workspaceType: string,
): WorkspaceEngagementCapabilities | null {
  const key = workspaceType.trim().toLowerCase();
  return (WORKSPACE_ENGAGEMENT_CAPABILITIES as Record<string, WorkspaceEngagementCapabilities>)[key] ?? null;
}
`;
}

/**
 * @param {readonly Record<string, unknown>[]} manifests
 */
export function generateWorkspaceEngagementBindings(manifests) {
  /** @type {string[]} */
  const bindingBlocks = [];

  for (const m of manifests) {
    const engagement = m.workspaceEngagement;
    if (engagement === undefined || engagement.supported !== true) {
      continue;
    }
    assertEngagementCapabilities(m);
    const workspaceTypes = Array.isArray(m.workspaceTypes) ? m.workspaceTypes : [];
    if (workspaceTypes.length === 0) {
      throw new Error(
        `workspace.manifest.json ${m.id}: workspaceTypes required for engagement bindings`,
      );
    }
    const defaultField =
      engagement.defaultModuleEnabledWhenUnset === true
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
export const WORKSPACE_ENGAGEMENT_BINDINGS = [] as const;

export function isEngagementSupportedWorkspace(_workspaceType: string): boolean {
  return false;
}

export function isEngagementDefaultEnabledWhenModulesUnset(_workspaceType: string): boolean {
  return false;
}
`;
  }

  return `${BANNER}
export const WORKSPACE_ENGAGEMENT_BINDINGS = [
${bindingBlocks.join("\n")}
] as const;

const supportedWorkspaceTypes = new Set(
  WORKSPACE_ENGAGEMENT_BINDINGS.map((binding) => binding.workspaceType as string),
);

const defaultEnabledWhenUnset = new Set(
  WORKSPACE_ENGAGEMENT_BINDINGS.filter(
    (binding) =>
      "defaultModuleEnabledWhenUnset" in binding &&
      binding.defaultModuleEnabledWhenUnset === true,
  ).map((binding) => binding.workspaceType as string),
);

export function isEngagementSupportedWorkspace(workspaceType: string): boolean {
  return supportedWorkspaceTypes.has(workspaceType.trim().toLowerCase());
}

export function isEngagementDefaultEnabledWhenModulesUnset(workspaceType: string): boolean {
  return defaultEnabledWhenUnset.has(workspaceType.trim().toLowerCase());
}
`;
}
