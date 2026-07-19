import { BANNER } from "../constants.mjs";
import { importSpecifier } from "../utils.mjs";

const BOOKING_DEPENDENCY_FIELDS = [
  "publicBooking",
  "capacityPolicy",
  "validationPolicy",
  "opsCapability",
];

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
    // registryOnly + supported: architecture fixtures (B1.3) — in capability bindings,
    // excluded from product plugin loaders via productWorkspaceManifests.
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
    const present = BOOKING_DEPENDENCY_FIELDS.filter((field) => booking[field] !== undefined);
    if (present.length === 0) {
      continue;
    }
    if (present.length !== BOOKING_DEPENDENCY_FIELDS.length) {
      throw new Error(
        `workspace.manifest.json ${m.id}: workspaceBooking publicBooking, capacityPolicy, validationPolicy, and opsCapability must be declared together (got: ${present.join(", ") || "none"})`
      );
    }

    const publicBooking = assertBookingModuleExport(booking.publicBooking, m.id, "publicBooking");
    const capacity = assertBookingModuleExport(booking.capacityPolicy, m.id, "capacityPolicy");
    const validation = assertBookingModuleExport(booking.validationPolicy, m.id, "validationPolicy");
    const ops = assertBookingModuleExport(booking.opsCapability, m.id, "opsCapability");

    const workspaceTypes = Array.isArray(m.workspaceTypes) ? m.workspaceTypes : [];
    if (workspaceTypes.length === 0) {
      throw new Error(`workspace.manifest.json ${m.id}: workspaceTypes required for booking dependency bindings`);
    }

    const safeId = m.id.replace(/[^a-zA-Z0-9]/g, "_");
    const aliases = {
      publicBooking: `${safeId}_PublicBooking`,
      capacityPolicy: `${safeId}_CapacityPolicy`,
      validationPolicy: `${safeId}_ValidationPolicy`,
      opsCapability: `${safeId}_OpsCapability`,
    };
    const declared = [
      { field: "publicBooking", ...publicBooking, alias: aliases.publicBooking },
      { field: "capacityPolicy", ...capacity, alias: aliases.capacityPolicy },
      { field: "validationPolicy", ...validation, alias: aliases.validationPolicy },
      { field: "opsCapability", ...ops, alias: aliases.opsCapability },
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
    createOpsCapability: () => new ${aliases.opsCapability}(),
  },`);
    }
  }

  if (bindingEntries.length === 0) {
    return `${BANNER}
export const WORKSPACE_BOOKING_DEPENDENCY_BINDINGS = {} as const;

export function isBookingDependencyBindingRegistered(_workspaceType: string): boolean {
  return false;
}

export function listBookingDependencyWorkspaceTypes(): readonly string[] {
  return [];
}

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

export function isBookingDependencyBindingRegistered(workspaceType: string): boolean {
  return workspaceType.trim().toLowerCase() in WORKSPACE_BOOKING_DEPENDENCY_BINDINGS;
}

export function listBookingDependencyWorkspaceTypes(): readonly string[] {
  return Object.keys(WORKSPACE_BOOKING_DEPENDENCY_BINDINGS).sort();
}

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
    opsCapability: binding.createOpsCapability(),
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
    const requiresHostIo = reaction.requiresHostIo === true;
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
export const WORKSPACE_BOOKING_EVENT_REACTION_BINDINGS = {} as const;

export function isBookingEventReactionBindingRegistered(_workspaceType: string): boolean {
  return false;
}
`;
  }

  return `${BANNER}
${[...new Set(importLines)].join("\n\n")}

export const WORKSPACE_BOOKING_EVENT_REACTION_BINDINGS = {
${bindingEntries.join("\n")}
} as const;

export function isBookingEventReactionBindingRegistered(workspaceType: string): boolean {
  return workspaceType.trim().toLowerCase() in WORKSPACE_BOOKING_EVENT_REACTION_BINDINGS;
}
`;
}
