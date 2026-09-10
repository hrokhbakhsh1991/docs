import { BANNER } from "../constants.mjs";

const TICKET_PRIORITIES = ["low", "normal", "high", "urgent"];

/**
 * @param {unknown} value
 */
function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * @param {object} m
 */
export function assertTicketingCapabilities(m) {
  const ticketing = m.workspaceTicketing;
  if (ticketing === undefined || ticketing.supported !== true) {
    return;
  }
  const caps = ticketing.capabilities;
  if (!isRecord(caps)) {
    throw new Error(
      `workspace.manifest.json ${m.id}: workspaceTicketing.supported requires capabilities object`,
    );
  }
  for (const key of [
    "memberCreate",
    "operatorInbox",
    "tags",
    "queues",
    "teams",
    "attachments",
  ]) {
    if (caps[key] !== undefined && typeof caps[key] !== "boolean") {
      throw new Error(
        `workspace.manifest.json ${m.id}: workspaceTicketing.capabilities.${key} must be boolean when declared`,
      );
    }
  }
  const categories = ticketing.categories;
  if (!Array.isArray(categories) || categories.length === 0) {
    throw new Error(
      `workspace.manifest.json ${m.id}: workspaceTicketing.supported requires non-empty categories[]`,
    );
  }
  const codes = new Set();
  for (const entry of categories) {
    if (!isRecord(entry)) {
      throw new Error(
        `workspace.manifest.json ${m.id}: workspaceTicketing.categories entries must be objects`,
      );
    }
    if (typeof entry.code !== "string" || entry.code.trim().length < 2) {
      throw new Error(
        `workspace.manifest.json ${m.id}: workspaceTicketing.categories[].code must be a string slug`,
      );
    }
    if (codes.has(entry.code)) {
      throw new Error(
        `workspace.manifest.json ${m.id}: duplicate workspaceTicketing.categories code ${entry.code}`,
      );
    }
    codes.add(entry.code);
    if (typeof entry.labelKey !== "string" || entry.labelKey.trim().length === 0) {
      throw new Error(
        `workspace.manifest.json ${m.id}: workspaceTicketing.categories[].labelKey required`,
      );
    }
  }
  const defaultCategory = ticketing.defaultCategoryCode;
  if (typeof defaultCategory !== "string" || !codes.has(defaultCategory)) {
    throw new Error(
      `workspace.manifest.json ${m.id}: workspaceTicketing.defaultCategoryCode must match a categories[].code`,
    );
  }
  const allowedPriorities = ticketing.allowedPriorities;
  if (!Array.isArray(allowedPriorities) || allowedPriorities.length === 0) {
    throw new Error(
      `workspace.manifest.json ${m.id}: workspaceTicketing.allowedPriorities must be a non-empty array`,
    );
  }
  for (const priority of allowedPriorities) {
    if (typeof priority !== "string" || !TICKET_PRIORITIES.includes(priority)) {
      throw new Error(
        `workspace.manifest.json ${m.id}: workspaceTicketing.allowedPriorities invalid value ${String(priority)}`,
      );
    }
  }
}

/**
 * @param {Record<string, unknown>} manifest
 */
export function assertWorkspaceTicketingManifest(manifest) {
  const ticketing = manifest.workspaceTicketing;
  if (ticketing === undefined) {
    return;
  }
  if (!isRecord(ticketing)) {
    throw new Error(`workspace.manifest.json ${manifest.id}: workspaceTicketing must be an object`);
  }
  if (typeof ticketing.supported !== "boolean") {
    throw new Error(
      `workspace.manifest.json ${manifest.id}: workspaceTicketing.supported must be boolean`,
    );
  }
  if (ticketing.supported === true) {
    assertTicketingCapabilities(manifest);
  }
}

/**
 * @param {readonly Record<string, unknown>[]} manifests
 */
export function generateWorkspaceTicketingCapabilities(manifests) {
  /** @type {string[]} */
  const capabilityEntries = [];

  for (const m of manifests) {
    const ticketing = m.workspaceTicketing;
    if (ticketing === undefined || ticketing.supported !== true) {
      continue;
    }
    assertTicketingCapabilities(m);
    const workspaceTypes = Array.isArray(m.workspaceTypes) ? m.workspaceTypes : [];
    if (workspaceTypes.length === 0) {
      throw new Error(
        `workspace.manifest.json ${m.id}: workspaceTypes required for ticketing capabilities`,
      );
    }
    const caps = ticketing.capabilities;
    const categories = ticketing.categories.map((entry) => {
      const category = /** @type {Record<string, unknown>} */ (entry);
      return `      {
        code: ${JSON.stringify(String(category.code))},
        labelKey: ${JSON.stringify(String(category.labelKey))},
        ${category.description !== undefined ? `description: ${JSON.stringify(String(category.description))},` : ""}
        ${category.icon !== undefined ? `icon: ${JSON.stringify(String(category.icon))},` : ""}
        sortOrder: ${typeof category.sortOrder === "number" ? category.sortOrder : 0},
        ${category.defaultPriority !== undefined ? `defaultPriority: ${JSON.stringify(String(category.defaultPriority))},` : ""}
      }`;
    });
    for (const wt of workspaceTypes) {
      if (typeof wt !== "string" || wt.trim().length === 0) {
        continue;
      }
      capabilityEntries.push(`  ${JSON.stringify(wt.trim().toLowerCase())}: {
    supported: true as const,
    defaultModuleEnabledWhenUnset: ${ticketing.defaultModuleEnabledWhenUnset === true ? "true" : "false"} as const,
    memberCreate: ${caps.memberCreate === true ? "true" : "false"} as const,
    operatorInbox: ${caps.operatorInbox === true ? "true" : "false"} as const,
    tags: ${caps.tags === true ? "true" : "false"} as const,
    queues: ${caps.queues === true ? "true" : "false"} as const,
    teams: ${caps.teams === true ? "true" : "false"} as const,
    attachments: ${caps.attachments === true ? "true" : "false"} as const,
    defaultCategoryCode: ${JSON.stringify(String(ticketing.defaultCategoryCode))},
    allowedPriorities: ${JSON.stringify(ticketing.allowedPriorities)} as const,
    maxAttachmentSizeBytes: ${typeof ticketing.maxAttachmentSizeBytes === "number" ? ticketing.maxAttachmentSizeBytes : 10_485_760},
    categories: [
${categories.join(",\n")}
    ] as const,
  },`);
    }
  }

  if (capabilityEntries.length === 0) {
    return `${BANNER}
export type WorkspaceTicketingCategoryDefinition = {
  readonly code: string;
  readonly labelKey: string;
  readonly description?: string;
  readonly icon?: string;
  readonly sortOrder: number;
  readonly defaultPriority?: string;
};

export type WorkspaceTicketingCapabilities = {
  readonly supported: true;
  readonly defaultModuleEnabledWhenUnset: boolean;
  readonly memberCreate: boolean;
  readonly operatorInbox: boolean;
  readonly tags: boolean;
  readonly queues: boolean;
  readonly teams: boolean;
  readonly attachments: boolean;
  readonly defaultCategoryCode: string;
  readonly allowedPriorities: readonly string[];
  readonly maxAttachmentSizeBytes: number;
  readonly categories: readonly WorkspaceTicketingCategoryDefinition[];
};

export const WORKSPACE_TICKETING_CAPABILITIES = {} as const;

export function getWorkspaceTicketingCapabilities(
  _workspaceType: string,
): WorkspaceTicketingCapabilities | null {
  return null;
}

export function listTicketingCapableWorkspaceTypes(): readonly string[] {
  return [];
}
`;
  }

  return `${BANNER}
export type WorkspaceTicketingCategoryDefinition = {
  readonly code: string;
  readonly labelKey: string;
  readonly description?: string;
  readonly icon?: string;
  readonly sortOrder: number;
  readonly defaultPriority?: string;
};

export type WorkspaceTicketingCapabilities = {
  readonly supported: true;
  readonly defaultModuleEnabledWhenUnset: boolean;
  readonly memberCreate: boolean;
  readonly operatorInbox: boolean;
  readonly tags: boolean;
  readonly queues: boolean;
  readonly teams: boolean;
  readonly attachments: boolean;
  readonly defaultCategoryCode: string;
  readonly allowedPriorities: readonly string[];
  readonly maxAttachmentSizeBytes: number;
  readonly categories: readonly WorkspaceTicketingCategoryDefinition[];
};

export const WORKSPACE_TICKETING_CAPABILITIES = {
${capabilityEntries.join("\n")}
} as const satisfies Record<string, WorkspaceTicketingCapabilities>;

export function getWorkspaceTicketingCapabilities(
  workspaceType: string,
): WorkspaceTicketingCapabilities | null {
  const key = workspaceType.trim().toLowerCase();
  if (key.length === 0) {
    return null;
  }
  const caps = (WORKSPACE_TICKETING_CAPABILITIES as Record<string, WorkspaceTicketingCapabilities>)[key];
  return caps ?? null;
}

export function listTicketingCapableWorkspaceTypes(): readonly string[] {
  return Object.keys(WORKSPACE_TICKETING_CAPABILITIES).sort();
}
`;
}

/**
 * @param {readonly Record<string, unknown>[]} manifests
 */
export function generateWorkspaceTicketingBindings(manifests) {
  /** @type {string[]} */
  const bindingBlocks = [];

  for (const m of manifests) {
    const ticketing = m.workspaceTicketing;
    if (ticketing === undefined || ticketing.supported !== true) {
      continue;
    }
    assertTicketingCapabilities(m);
    const workspaceTypes = Array.isArray(m.workspaceTypes) ? m.workspaceTypes : [];
    for (const wt of workspaceTypes) {
      if (typeof wt !== "string" || wt.trim().length === 0) {
        continue;
      }
      const defaultField =
        ticketing.defaultModuleEnabledWhenUnset === true
          ? `\n    defaultModuleEnabledWhenUnset: true as const,`
          : "";
      bindingBlocks.push(`  {
    workspaceType: ${JSON.stringify(wt.trim().toLowerCase())},${defaultField}
  },`);
    }
  }

  if (bindingBlocks.length === 0) {
    return `${BANNER}
export const WORKSPACE_TICKETING_BINDINGS = [] as const;

export function isTicketingSupportedWorkspace(_workspaceType: string): boolean {
  return false;
}

export function isTicketingDefaultEnabledWhenModulesUnset(_workspaceType: string): boolean {
  return false;
}
`;
  }

  return `${BANNER}
export const WORKSPACE_TICKETING_BINDINGS = [
${bindingBlocks.join("\n")}
] as const;

const supportedWorkspaceTypes = new Set(
  WORKSPACE_TICKETING_BINDINGS.map((binding) => binding.workspaceType as string),
);

const defaultEnabledWhenUnset = new Set(
  WORKSPACE_TICKETING_BINDINGS.filter(
    (binding) => "defaultModuleEnabledWhenUnset" in binding && binding.defaultModuleEnabledWhenUnset === true,
  ).map((binding) => binding.workspaceType as string),
);

export function isTicketingSupportedWorkspace(workspaceType: string): boolean {
  return supportedWorkspaceTypes.has(workspaceType.trim().toLowerCase());
}

export function isTicketingDefaultEnabledWhenModulesUnset(workspaceType: string): boolean {
  return defaultEnabledWhenUnset.has(workspaceType.trim().toLowerCase());
}
`;
}
