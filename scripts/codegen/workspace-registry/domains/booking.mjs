import { BANNER } from "../constants.mjs";
import { importSpecifier } from "../utils.mjs";

/** Runtime-owned dependency bag (ops UI is opsManifest → web bindings, not this bag). */
const BOOKING_DEPENDENCY_FIELDS = [
  "publicBooking",
  "capacityPolicy",
  "validationPolicy",
];

/** @type {Readonly<Record<string, ReadonlySet<string>>>} */
const BOOKING_CAPABILITY_MODES = {
  publicCreate: new Set(["none", "create-pipeline"]),
  operatorCreate: new Set(["none", "create-pipeline"]),
  validation: new Set(["none", "base-shape"]),
  capacity: new Set(["none", "booking-owned"]),
  approval: new Set(["none", "host-lifecycle"]),
  eventReaction: new Set(["none", "in-process"]),
};

const BOOKING_GRADED_CAPABILITY_KEYS = [
  "publicCreate",
  "operatorCreate",
  "validation",
  "capacity",
  "approval",
  "eventReaction",
];

/**
 * Graded capability = executable `{ enabled, mode }` only.
 * `owner` metadata is forbidden (decorative — never consumed at runtime).
 *
 * @param {unknown} entry
 * @param {string} workspaceId
 * @param {string} key
 */
function assertGradedCapabilityEntry(entry, workspaceId, key) {
  if (entry === undefined || typeof entry !== "object" || entry === null) {
    throw new Error(
      `workspace.manifest.json ${workspaceId}: workspaceBooking.capabilities.${key} must be { enabled, mode }`
    );
  }
  const rec = /** @type {Record<string, unknown>} */ (entry);
  if ("owner" in rec) {
    throw new Error(
      `workspace.manifest.json ${workspaceId}: capabilities.${key}.owner is removed — declare only enabled+mode (no decorative ownership metadata)`
    );
  }
  if ("level" in rec) {
    throw new Error(
      `workspace.manifest.json ${workspaceId}: capabilities.${key}.level is not a capability field`
    );
  }
  if (typeof rec.enabled !== "boolean") {
    throw new Error(
      `workspace.manifest.json ${workspaceId}: workspaceBooking.capabilities.${key}.enabled must be boolean`
    );
  }
  const modes = BOOKING_CAPABILITY_MODES[key];
  if (typeof rec.mode !== "string" || !modes.has(rec.mode)) {
    throw new Error(
      `workspace.manifest.json ${workspaceId}: workspaceBooking.capabilities.${key}.mode must be ${[...modes].join("|")}`
    );
  }
  if (rec.enabled === true && rec.mode === "none") {
    throw new Error(
      `workspace.manifest.json ${workspaceId}: capabilities.${key}.enabled=true forbids mode=none`
    );
  }
  if (rec.enabled === false && rec.mode !== "none") {
    throw new Error(
      `workspace.manifest.json ${workspaceId}: capabilities.${key}.enabled=false requires mode=none`
    );
  }
  return {
    enabled: rec.enabled,
    mode: /** @type {string} */ (rec.mode),
  };
}

/**
 * Booking B3.0 — `supported` is product enablement only; graded honesty lives in capabilities.
 * Fails generation when claims exceed declared implementation bindings.
 *
 * @param {object} m
 */
export function assertBookingCapabilities(m) {
  const booking = m.workspaceBooking;
  if (booking === undefined || booking.supported !== true) {
    return;
  }
  const caps = booking.capabilities;
  if (caps === undefined || typeof caps !== "object" || caps === null) {
    throw new Error(
      `workspace.manifest.json ${m.id}: workspaceBooking.supported requires capabilities { enabled, publicCreate, operatorCreate, validation, capacity, approval, eventReaction }`
    );
  }
  if (typeof caps.enabled !== "boolean") {
    throw new Error(
      `workspace.manifest.json ${m.id}: workspaceBooking.capabilities.enabled must be boolean`
    );
  }
  if (caps.enabled !== true) {
    throw new Error(
      `workspace.manifest.json ${m.id}: workspaceBooking.supported requires capabilities.enabled=true`
    );
  }
  if ("ops" in caps) {
    throw new Error(
      `workspace.manifest.json ${m.id}: capabilities.ops removed — ops UI is opsManifest (web), not API graded matrix`
    );
  }

  /** @type {Record<string, { enabled: boolean, mode: string }>} */
  const graded = {};
  for (const key of BOOKING_GRADED_CAPABILITY_KEYS) {
    graded[key] = assertGradedCapabilityEntry(caps[key], m.id, key);
  }

  // --- anti-overclaim vs implementation evidence ---

  const needsDepBag =
    graded.publicCreate.enabled ||
    graded.operatorCreate.enabled ||
    graded.validation.enabled ||
    (graded.capacity.enabled && graded.capacity.mode === "booking-owned");

  if (needsDepBag) {
    const missingDeps = BOOKING_DEPENDENCY_FIELDS.filter((field) => booking[field] === undefined);
    if (missingDeps.length > 0) {
      throw new Error(
        `workspace.manifest.json ${m.id}: graded create/validation/capacity claims require ${BOOKING_DEPENDENCY_FIELDS.join(", ")} (missing: ${missingDeps.join(", ")})`
      );
    }
  }

  if (
    graded.capacity.enabled &&
    graded.capacity.mode === "booking-owned" &&
    booking.capacityPolicy === undefined
  ) {
    throw new Error(
      `workspace.manifest.json ${m.id}: capabilities.capacity.mode=booking-owned requires capacityPolicy`
    );
  }

  if (graded.publicCreate.enabled && booking.publicBooking === undefined) {
    throw new Error(
      `workspace.manifest.json ${m.id}: capabilities.publicCreate requires publicBooking`
    );
  }
  if (graded.validation.enabled && booking.validationPolicy === undefined) {
    throw new Error(
      `workspace.manifest.json ${m.id}: capabilities.validation requires validationPolicy`
    );
  }

  const reaction = booking.eventReaction;
  if (graded.eventReaction.mode === "in-process") {
    if (reaction === undefined) {
      throw new Error(
        `workspace.manifest.json ${m.id}: capabilities.eventReaction.mode=in-process requires eventReaction`
      );
    }
    if (reaction.requiresHostIo === true) {
      throw new Error(
        `workspace.manifest.json ${m.id}: in-process eventReaction forbids requiresHostIo=true`
      );
    }
  } else if (reaction !== undefined) {
    throw new Error(
      `workspace.manifest.json ${m.id}: eventReaction declared but capabilities.eventReaction.mode=none`
    );
  }

  // opsManifest is web-only (optional). No API graded ops capability.
}

/**
 * Explicit capability matrix for supported booking workspaces (Booking B3.0).
 * `supported` alone must not be read as Denali-equivalent booking depth.
 */
export function generateWorkspaceBookingCapabilities(manifests) {
  /** @type {Set<string>} */
  const importLines = new Set();
  /** @type {string[]} */
  const capabilityEntries = [];

  for (const m of manifests) {
    const booking = m.workspaceBooking;
    if (booking === undefined || booking.supported !== true) {
      continue;
    }
    assertBookingCapabilities(m);
    const typeExport =
      typeof booking.workspaceTypeExport === "string" && booking.workspaceTypeExport.length > 0
        ? booking.workspaceTypeExport
        : m.tourWrite?.workspaceTypeExport;
    if (typeof typeExport !== "string" || typeExport.length === 0) {
      throw new Error(
        `workspace.manifest.json ${m.id}: workspaceBooking.supported requires workspaceBooking.workspaceTypeExport or tourWrite.workspaceTypeExport`
      );
    }
    const caps = booking.capabilities;
    importLines.add(`import { ${typeExport} } from "${m.package}";`);
    const lines = BOOKING_GRADED_CAPABILITY_KEYS.map((key) => {
      const entry = caps[key];
      return `    ${key}: {
      enabled: ${entry.enabled === true ? "true" : "false"} as const,
      mode: ${JSON.stringify(entry.mode)} as const,
    },`;
    });
    capabilityEntries.push(`  [${typeExport}]: {
    enabled: true as const,
${lines.join("\n")}
  },`);
  }

  if (capabilityEntries.length === 0) {
    return `${BANNER}
export type BookingCreateCapabilityMode = "none" | "create-pipeline";
export type BookingValidationCapabilityMode = "none" | "base-shape";
export type BookingCapacityCapabilityMode = "none" | "booking-owned";
export type BookingApprovalCapabilityMode = "none" | "host-lifecycle";
export type BookingEventReactionCapabilityMode = "none" | "in-process";

export type BookingGradedCapability<TMode extends string> = {
  readonly enabled: boolean;
  readonly mode: TMode;
};

export type BookingWorkspaceCapabilities = {
  readonly enabled: true;
  readonly publicCreate: BookingGradedCapability<BookingCreateCapabilityMode>;
  readonly operatorCreate: BookingGradedCapability<BookingCreateCapabilityMode>;
  readonly validation: BookingGradedCapability<BookingValidationCapabilityMode>;
  readonly capacity: BookingGradedCapability<BookingCapacityCapabilityMode>;
  readonly approval: BookingGradedCapability<BookingApprovalCapabilityMode>;
  readonly eventReaction: BookingGradedCapability<BookingEventReactionCapabilityMode>;
};

export const WORKSPACE_BOOKING_CAPABILITIES = {} as const;

export function getBookingWorkspaceCapabilities(
  _workspaceType: string
): BookingWorkspaceCapabilities | null {
  return null;
}
`;
  }

  return `${BANNER}
${[...importLines].join("\n")}

export type BookingCreateCapabilityMode = "none" | "create-pipeline";
export type BookingValidationCapabilityMode = "none" | "base-shape";
export type BookingCapacityCapabilityMode = "none" | "booking-owned";
export type BookingApprovalCapabilityMode = "none" | "host-lifecycle";
export type BookingEventReactionCapabilityMode = "none" | "in-process";

export type BookingGradedCapability<TMode extends string> = {
  readonly enabled: boolean;
  readonly mode: TMode;
};

export type BookingWorkspaceCapabilities = {
  readonly enabled: true;
  readonly publicCreate: BookingGradedCapability<BookingCreateCapabilityMode>;
  readonly operatorCreate: BookingGradedCapability<BookingCreateCapabilityMode>;
  readonly validation: BookingGradedCapability<BookingValidationCapabilityMode>;
  readonly capacity: BookingGradedCapability<BookingCapacityCapabilityMode>;
  readonly approval: BookingGradedCapability<BookingApprovalCapabilityMode>;
  readonly eventReaction: BookingGradedCapability<BookingEventReactionCapabilityMode>;
};

/**
 * Capability matrix — product gate (\`supported\`) vs graded booking depth.
 * Graded entries are enabled+mode only (API runtime; ops UI is opsManifest → web).
 */
export const WORKSPACE_BOOKING_CAPABILITIES = {
${capabilityEntries.join("\n")}
} as const satisfies Record<string, BookingWorkspaceCapabilities>;

export function getBookingWorkspaceCapabilities(
  workspaceType: string
): BookingWorkspaceCapabilities | null {
  const key = workspaceType.trim();
  if (key.length === 0) {
    return null;
  }
  const caps = (WORKSPACE_BOOKING_CAPABILITIES as Record<string, BookingWorkspaceCapabilities>)[key];
  return caps ?? null;
}
`;
}

/**
 * Phase B1.0 / B1.8 — Booking capability enablement bindings (Finance workspaceFinance mirror).
 * supported + defaultModuleEnabledWhenUnset — dependency modules B1.1; completeness B1.8.
 */
export function generateWorkspaceBookingBindings(manifests) {
  /** @type {Set<string>} */
  const importLines = new Set();
  /** @type {string[]} */
  const bindingBlocks = [];

  for (const m of manifests) {
    const booking = m.workspaceBooking;
    if (booking === undefined || booking.supported !== true) {
      continue;
    }
    assertBookingCapabilities(m);
    if (booking.registryOnly === true) {
      throw new Error(
        `workspace.manifest.json ${m.id}: workspaceBooking.supported cannot be true when registryOnly is true (B1.3 — no decorative support claims)`
      );
    }
    const missingDeps = BOOKING_DEPENDENCY_FIELDS.filter((field) => booking[field] === undefined);
    if (missingDeps.length > 0) {
      throw new Error(
        `workspace.manifest.json ${m.id}: workspaceBooking.supported requires ${BOOKING_DEPENDENCY_FIELDS.join(", ")} (Phase B1.8; missing: ${missingDeps.join(", ")})`
      );
    }
    const typeExport =
      typeof booking.workspaceTypeExport === "string" && booking.workspaceTypeExport.length > 0
        ? booking.workspaceTypeExport
        : m.tourWrite?.workspaceTypeExport;
    if (typeof typeExport !== "string" || typeExport.length === 0) {
      throw new Error(
        `workspace.manifest.json ${m.id}: workspaceBooking.supported requires workspaceBooking.workspaceTypeExport or tourWrite.workspaceTypeExport`
      );
    }
    importLines.add(`import { ${typeExport} } from "${m.package}";`);
    const defaultField =
      booking.defaultModuleEnabledWhenUnset === true
        ? `\n    defaultModuleEnabledWhenUnset: true as const,`
        : "";
    bindingBlocks.push(`  {
    workspaceType: ${typeExport},${defaultField}
  },`);
  }

  if (bindingBlocks.length === 0) {
    return `${BANNER}
export const WORKSPACE_BOOKING_BINDINGS = [] as const;

export function isBookingSupportedWorkspace(_workspaceType: string): boolean {
  return false;
}

export function defaultBookingEnabledWhenModulesUnset(_workspaceType: string): boolean {
  return false;
}
`;
  }

  return `${BANNER}
${[...importLines].join("\n")}

export const WORKSPACE_BOOKING_BINDINGS = [
${bindingBlocks.join("\n")}
] as const;

const supportedWorkspaceTypes = new Set(
  WORKSPACE_BOOKING_BINDINGS.map((binding) => binding.workspaceType as string)
);

const defaultEnabledWhenUnset = new Set(
  WORKSPACE_BOOKING_BINDINGS.filter(
    (binding) => "defaultModuleEnabledWhenUnset" in binding && binding.defaultModuleEnabledWhenUnset === true
  ).map((binding) => binding.workspaceType as string)
);

export function isBookingSupportedWorkspace(workspaceType: string): boolean {
  return supportedWorkspaceTypes.has(workspaceType);
}

export function defaultBookingEnabledWhenModulesUnset(workspaceType: string): boolean {
  return defaultEnabledWhenUnset.has(workspaceType);
}
`;
}

/**
 * @param {unknown} block
 * @param {string} workspaceId
 * @param {string} field
 */
function assertBookingModuleExport(block, workspaceId, field) {
  if (block === undefined || typeof block !== "object" || block === null) {
    throw new Error(`workspace.manifest.json ${workspaceId}: workspaceBooking.${field} required`);
  }
  const rec = /** @type {Record<string, unknown>} */ (block);
  if (typeof rec.module !== "string" || rec.module.length === 0) {
    throw new Error(`workspace.manifest.json ${workspaceId}: workspaceBooking.${field}.module required`);
  }
  if (typeof rec.export !== "string" || rec.export.length === 0) {
    throw new Error(`workspace.manifest.json ${workspaceId}: workspaceBooking.${field}.export required`);
  }
  return { module: rec.module, export: rec.export };
}

/**
 * Phase B1.1 — Booking dependency factories (Finance dependency bindings mirror).
 * Registration only — resolveBookingWorkspaceDependencies is unused by runtime until later phases.
 */
export function generateWorkspaceBookingDependencyBindings(manifests) {
  /** @type {string[]} */
  const importLines = [];
  /** @type {string[]} */
  const bindingEntries = [];

  for (const m of manifests) {
    const booking = m.workspaceBooking;
    if (booking === undefined) {
      continue;
    }
    if (booking.supported === true) {
      assertBookingCapabilities(m);
    }
    const present = BOOKING_DEPENDENCY_FIELDS.filter((field) => booking[field] !== undefined);
    if (present.length === 0) {
      continue;
    }
    if (present.length !== BOOKING_DEPENDENCY_FIELDS.length) {
      throw new Error(
        `workspace.manifest.json ${m.id}: workspaceBooking publicBooking, capacityPolicy, and validationPolicy must be declared together (got: ${present.join(", ") || "none"})`
      );
    }
    if (booking.opsCapability !== undefined) {
      throw new Error(
        `workspace.manifest.json ${m.id}: workspaceBooking.opsCapability is removed — ops UI ownership is workspaceBooking.opsManifest (web bindings), not the API dependency bag`
      );
    }

    const publicBooking = assertBookingModuleExport(booking.publicBooking, m.id, "publicBooking");
    const capacity = assertBookingModuleExport(booking.capacityPolicy, m.id, "capacityPolicy");
    const validation = assertBookingModuleExport(booking.validationPolicy, m.id, "validationPolicy");

    const workspaceTypes = Array.isArray(m.workspaceTypes) ? m.workspaceTypes : [];
    if (workspaceTypes.length === 0) {
      throw new Error(`workspace.manifest.json ${m.id}: workspaceTypes required for booking dependency bindings`);
    }

    const safeId = m.id.replace(/[^a-zA-Z0-9]/g, "_");
    const aliases = {
      publicBooking: `${safeId}_PublicBooking`,
      capacityPolicy: `${safeId}_CapacityPolicy`,
      validationPolicy: `${safeId}_ValidationPolicy`,
    };
    const declared = [
      { field: "publicBooking", ...publicBooking, alias: aliases.publicBooking },
      { field: "capacityPolicy", ...capacity, alias: aliases.capacityPolicy },
      { field: "validationPolicy", ...validation, alias: aliases.validationPolicy },
    ];

    /** @type {Map<string, { export: string, alias: string }[]>} */
    const bySpec = new Map();
    for (const row of declared) {
      const spec = importSpecifier(m.package, row.module);
      const list = bySpec.get(spec) ?? [];
      list.push({ export: row.export, alias: row.alias });
      bySpec.set(spec, list);
    }
    for (const [spec, rows] of bySpec) {
      if (rows.length === 1) {
        importLines.push(`import { ${rows[0].export} as ${rows[0].alias} } from "${spec}";`);
      } else {
        const body = rows.map((r) => `  ${r.export} as ${r.alias},`).join("\n");
        importLines.push(`import {\n${body}\n} from "${spec}";`);
      }
    }

    for (const wt of workspaceTypes) {
      if (typeof wt !== "string" || wt.trim().length === 0) {
        throw new Error(`workspace.manifest.json ${m.id}: invalid workspaceType in booking dependency bindings`);
      }
      bindingEntries.push(`  ${JSON.stringify(wt.trim().toLowerCase())}: {
    createPublicBooking: () => new ${aliases.publicBooking}(),
    createCapacityPolicy: () => new ${aliases.capacityPolicy}(),
    createValidationPolicy: () => new ${aliases.validationPolicy}(),
  },`);
    }
  }

  if (bindingEntries.length === 0) {
    return `${BANNER}
export const WORKSPACE_BOOKING_DEPENDENCY_BINDINGS = {} as const;

export function resolveBookingWorkspaceDependencies(workspaceType: string): never {
  throw new Error(
    \`BOOKING_WORKSPACE_DEPENDENCIES_UNSUPPORTED: no booking dependency registration for workspaceType=\${workspaceType}\`
  );
}
`;
  }

  return `${BANNER}
${[...new Set(importLines)].join("\n\n")}

export const WORKSPACE_BOOKING_DEPENDENCY_BINDINGS = {
${bindingEntries.join("\n")}
} as const;

export function resolveBookingWorkspaceDependencies(workspaceType: string) {
  const normalized = workspaceType.trim().toLowerCase();
  if (normalized.length === 0) {
    throw new Error(
      "BOOKING_WORKSPACE_TYPE_REQUIRED: workspaceType is required to resolve booking dependencies"
    );
  }
  const binding =
    WORKSPACE_BOOKING_DEPENDENCY_BINDINGS[
      normalized as keyof typeof WORKSPACE_BOOKING_DEPENDENCY_BINDINGS
    ];
  if (binding === undefined) {
    throw new Error(
      \`BOOKING_WORKSPACE_DEPENDENCIES_UNSUPPORTED: no booking dependency registration for workspaceType=\${workspaceType}\`
    );
  }
  return {
    workspaceType: normalized,
    publicBooking: binding.createPublicBooking(),
    capacityPolicy: binding.createCapacityPolicy(),
    validationPolicy: binding.createValidationPolicy(),
  };
}
`;
}

/**
 * Web Booking ops UI metadata — pluginId → workspace ops manifest (Phase B1.6).
 * Generic apps/web must resolve via these bindings; never hard-import a workspace package.
 */
export function generateWorkspaceBookingOpsBindings(manifests) {
  /** @type {string[]} */
  const importLines = [];
  /** @type {string[]} */
  const bindingEntries = [];

  for (const m of manifests) {
    const ops = m.workspaceBooking?.opsManifest;
    if (ops === undefined) {
      continue;
    }
    if (typeof ops.module !== "string" || ops.module.length === 0) {
      throw new Error(`workspace.manifest.json ${m.id}: workspaceBooking.opsManifest.module required`);
    }
    if (typeof ops.defaultExport !== "string" || ops.defaultExport.length === 0) {
      throw new Error(
        `workspace.manifest.json ${m.id}: workspaceBooking.opsManifest.defaultExport required`
      );
    }
    if (typeof ops.resolveFromThemeExport !== "string" || ops.resolveFromThemeExport.length === 0) {
      throw new Error(
        `workspace.manifest.json ${m.id}: workspaceBooking.opsManifest.resolveFromThemeExport required`
      );
    }
    const spec = importSpecifier(m.package, ops.module);
    const defaultAlias = `${m.id.replace(/[^a-zA-Z0-9]/g, "_")}_bookingOpsDefault`;
    const resolveAlias = `${m.id.replace(/[^a-zA-Z0-9]/g, "_")}_bookingOpsResolveFromTheme`;
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
import type { BookingOpsCapability } from "@/features/bookings/booking-ops-capability-contract";

export const WORKSPACE_BOOKING_OPS_PLUGIN_IDS = new Set<string>([]);

export function hasBookingOpsManifest(pluginId: string): boolean {
  return false;
}

export function resolveWorkspaceBookingOpsManifest(
  pluginId: string,
  _theme: unknown = null
): BookingOpsCapability {
  throw new Error(\`Booking ops capability not registered for pluginId=\${pluginId}\`);
}
`;
  }

  return `${BANNER}
import type { BookingOpsCapability } from "@/features/bookings/booking-ops-capability-contract";

${[...new Set(importLines)].join("\n\n")}

export const WORKSPACE_BOOKING_OPS_BINDINGS = {
${bindingEntries.join("\n")}
} as const;

export const WORKSPACE_BOOKING_OPS_PLUGIN_IDS = new Set<string>(
  Object.keys(WORKSPACE_BOOKING_OPS_BINDINGS)
);

export function hasBookingOpsManifest(pluginId: string): boolean {
  return pluginId in WORKSPACE_BOOKING_OPS_BINDINGS;
}

export function resolveWorkspaceBookingOpsManifest(
  pluginId: string,
  theme: unknown = null
): BookingOpsCapability {
  const binding = WORKSPACE_BOOKING_OPS_BINDINGS[pluginId as keyof typeof WORKSPACE_BOOKING_OPS_BINDINGS];
  if (binding === undefined) {
    throw new Error(\`Booking ops capability not registered for pluginId=\${pluginId}\`);
  }
  if (theme === null || theme === undefined) {
    return binding.defaultManifest;
  }
  return binding.resolveFromTheme(theme);
}
`;
}

/**
 * Booking lifecycle event reaction adapters (Phase B1.7 — Finance eventReaction mirror).
 * Workspace owns approve outbox event type; host injects HostIo only when requiresHostIo.
 */
export function generateWorkspaceBookingEventReactionBindings(manifests) {
  /** @type {string[]} */
  const importLines = [];
  /** @type {string[]} */
  const bindingEntries = [];

  for (const m of manifests) {
    const reaction = m.workspaceBooking?.eventReaction;
    if (reaction === undefined) {
      continue;
    }
    const declared = assertBookingModuleExport(reaction, m.id, "eventReaction");
    const workspaceTypes = Array.isArray(m.workspaceTypes) ? m.workspaceTypes : [];
    if (workspaceTypes.length === 0) {
      throw new Error(`workspace.manifest.json ${m.id}: workspaceTypes required for eventReaction`);
    }
    const safeId = m.id.replace(/[^a-zA-Z0-9]/g, "_");
    const alias = `${safeId}_BookingEventReaction`;
    const spec = importSpecifier(m.package, declared.module);
    importLines.push(`import { ${declared.export} as ${alias} } from "${spec}";`);

    for (const wt of workspaceTypes) {
      if (typeof wt !== "string" || wt.trim().length === 0) {
        continue;
      }
      const key = JSON.stringify(wt.trim().toLowerCase());
      bindingEntries.push(`  ${key}: {
    create: () => new ${alias}(),
  },`);
    }
  }

  if (bindingEntries.length === 0) {
    return `${BANNER}
export const WORKSPACE_BOOKING_EVENT_REACTION_BINDINGS = {} as const;
`;
  }

  return `${BANNER}
${[...new Set(importLines)].join("\n\n")}

export const WORKSPACE_BOOKING_EVENT_REACTION_BINDINGS = {
${bindingEntries.join("\n")}
} as const;
`;
}
