import { BANNER } from "../constants.mjs";
import { importSpecifier } from "../utils.mjs";

const TRANSPORT_SURFACE_KEYS = [
  "wizardTourField",
  "catalogSnapshot",
  "catalogDetailSection",
  "registrationIntake",
  "registrationInitializer",
  "listProjection",
  "registrationNormalize",
];

/** Denali legacy transport bindings — CW7-06 compat until full CW7-07 field migration. */
const DENALI_LEGACY_TRANSPORT_BINDINGS = {
  catalogSnapshotReader: {
    module: "./catalog/read-denali-catalog-transport",
    export: "readDenaliCatalogTransportSnapshot",
  },
  registrationInitializer: {
    module: "./catalog/registration-flow/register-transport-initializer",
    export: "registerDenaliCatalogRegistrationTransportInitializer",
  },
  catalogIntakeTransportSurface: {
    module: "./catalog/denali-catalog-transport-intake",
    export: "denaliCatalogTransportIntakeSurface",
  },
  registrationTransportNormalizer: {
    module: "./http/resolve-denali-registration-transport",
    export: "normalizeDenaliRegistrationTransportIntake",
  },
};

/**
 * Resolve workspaceTransport block with legacy Denali alias fallback during transition.
 *
 * @param {Record<string, unknown>} manifest
 */
export function resolveWorkspaceTransportManifest(manifest) {
  const block = manifest.workspaceTransport;
  if (block !== undefined) {
    return block;
  }
  if (manifest.id !== "denali") {
    return undefined;
  }
  const legacyExport = manifest.catalogRegistrationFlow?.transportInitializerExport;
  if (typeof legacyExport !== "string" || legacyExport.length === 0) {
    return undefined;
  }
  return {
    supported: true,
    capabilities: {
      catalogSnapshot: true,
      catalogDetailSection: true,
      registrationIntake: true,
      registrationInitializer: true,
      listProjection: true,
      registrationNormalize: true,
    },
    ...DENALI_LEGACY_TRANSPORT_BINDINGS,
    registrationInitializer: {
      module: "./catalog/registration-flow/register-transport-initializer",
      export: legacyExport,
    },
  };
}

/**
 * @param {Record<string, unknown>} manifest
 */
export function resolveTransportRegistrationInitializerExport(manifest) {
  const transport = resolveWorkspaceTransportManifest(manifest);
  if (
    transport !== undefined &&
    typeof transport === "object" &&
    transport !== null &&
    transport.supported === true &&
    transport.capabilities?.registrationInitializer === true &&
    transport.registrationInitializer !== undefined
  ) {
    return transport.registrationInitializer;
  }
  const legacy = manifest.catalogRegistrationFlow?.transportInitializerExport;
  if (typeof legacy === "string" && legacy.length > 0) {
    return { module: "./catalog-registration-flow", export: legacy };
  }
  return undefined;
}

/**
 * @param {Record<string, unknown>} manifest
 */
export function assertWorkspaceTransportManifest(manifest) {
  const transport = resolveWorkspaceTransportManifest(manifest);
  if (transport === undefined) {
    return;
  }
  if (typeof transport !== "object" || transport === null || Array.isArray(transport)) {
    throw new Error(`workspace.manifest.json ${manifest.id}: workspaceTransport must be an object`);
  }
  if (typeof transport.supported !== "boolean") {
    throw new Error(`workspace.manifest.json ${manifest.id}: workspaceTransport.supported must be boolean`);
  }
  if (transport.supported === false) {
    for (const key of [
      "catalogSnapshotReader",
      "registrationInitializer",
      "catalogIntakeTransportSurface",
      "registrationTransportNormalizer",
      "fieldModule",
      "wizardComposite",
    ]) {
      if (transport[key] !== undefined) {
        throw new Error(
          `workspace.manifest.json ${manifest.id}: workspaceTransport.supported=false forbids ${key}`
        );
      }
    }
    return;
  }
  const caps = transport.capabilities ?? {};
  if (typeof caps !== "object" || caps === null || Array.isArray(caps)) {
    throw new Error(`workspace.manifest.json ${manifest.id}: workspaceTransport.capabilities must be an object`);
  }
  for (const key of TRANSPORT_SURFACE_KEYS) {
    if (caps[key] !== undefined && typeof caps[key] !== "boolean") {
      throw new Error(
        `workspace.manifest.json ${manifest.id}: workspaceTransport.capabilities.${key} must be boolean`
      );
    }
  }
  if (caps.catalogSnapshot === true && transport.catalogSnapshotReader === undefined) {
    throw new Error(
      `workspace.manifest.json ${manifest.id}: capabilities.catalogSnapshot requires catalogSnapshotReader`
    );
  }
  if (caps.registrationIntake === true && transport.catalogIntakeTransportSurface === undefined) {
    throw new Error(
      `workspace.manifest.json ${manifest.id}: capabilities.registrationIntake requires catalogIntakeTransportSurface`
    );
  }
  if (caps.registrationInitializer === true && transport.registrationInitializer === undefined) {
    throw new Error(
      `workspace.manifest.json ${manifest.id}: capabilities.registrationInitializer requires registrationInitializer`
    );
  }
  if (caps.registrationNormalize === true && transport.registrationTransportNormalizer === undefined) {
    throw new Error(
      `workspace.manifest.json ${manifest.id}: capabilities.registrationNormalize requires registrationTransportNormalizer`
    );
  }
  if (caps.wizardTourField === true) {
    if (transport.fieldModule === undefined) {
      throw new Error(
        `workspace.manifest.json ${manifest.id}: capabilities.wizardTourField requires fieldModule`
      );
    }
    if (transport.wizardComposite === undefined) {
      throw new Error(
        `workspace.manifest.json ${manifest.id}: capabilities.wizardTourField requires wizardComposite`
      );
    }
  }
}

/**
 * @param {Record<string, unknown>} transport
 */
function resolveTransportSurfaceFlags(transport) {
  const caps = transport.capabilities ?? {};
  return Object.fromEntries(TRANSPORT_SURFACE_KEYS.map((key) => [key, caps[key] === true]));
}

/**
 * @param {readonly Record<string, unknown>[]} manifests
 */
export function generateWorkspaceTransportCapabilities(manifests) {
  /** @type {string[]} */
  const entries = [];

  for (const manifest of manifests) {
    assertWorkspaceTransportManifest(manifest);
    const transport = resolveWorkspaceTransportManifest(manifest);
    if (transport === undefined || transport.supported !== true) {
      continue;
    }
    const workspaceTypes = Array.isArray(manifest.workspaceTypes) ? manifest.workspaceTypes : [];
    const surfaces = resolveTransportSurfaceFlags(transport);
    for (const workspaceType of workspaceTypes) {
      if (typeof workspaceType !== "string" || workspaceType.trim().length === 0) {
        continue;
      }
      entries.push(`  ${JSON.stringify(workspaceType)}: {
    supported: true as const,
    wizardTourField: ${surfaces.wizardTourField ? "true" : "false"} as const,
    catalogSnapshot: ${surfaces.catalogSnapshot ? "true" : "false"} as const,
    catalogDetailSection: ${surfaces.catalogDetailSection ? "true" : "false"} as const,
    registrationIntake: ${surfaces.registrationIntake ? "true" : "false"} as const,
    registrationInitializer: ${surfaces.registrationInitializer ? "true" : "false"} as const,
    listProjection: ${surfaces.listProjection ? "true" : "false"} as const,
    registrationNormalize: ${surfaces.registrationNormalize ? "true" : "false"} as const,
  },`);
    }
  }

  if (entries.length === 0) {
    return `${BANNER}
export type WorkspaceTransportCapabilities = {
  readonly supported: true;
  readonly wizardTourField: boolean;
  readonly catalogSnapshot: boolean;
  readonly catalogDetailSection: boolean;
  readonly registrationIntake: boolean;
  readonly registrationInitializer: boolean;
  readonly listProjection: boolean;
  readonly registrationNormalize: boolean;
};

export const WORKSPACE_TRANSPORT_CAPABILITIES = {} as const;

export function getWorkspaceTransportCapabilities(
  _workspaceType: string
): WorkspaceTransportCapabilities | null {
  return null;
}
`;
  }

  return `${BANNER}
export type WorkspaceTransportCapabilities = {
  readonly supported: true;
  readonly wizardTourField: boolean;
  readonly catalogSnapshot: boolean;
  readonly catalogDetailSection: boolean;
  readonly registrationIntake: boolean;
  readonly registrationInitializer: boolean;
  readonly listProjection: boolean;
  readonly registrationNormalize: boolean;
};

export const WORKSPACE_TRANSPORT_CAPABILITIES = {
${entries.join("\n")}
} as const satisfies Record<string, WorkspaceTransportCapabilities>;

export function getWorkspaceTransportCapabilities(
  workspaceType: string
): WorkspaceTransportCapabilities | null {
  return (
    WORKSPACE_TRANSPORT_CAPABILITIES[
      workspaceType as keyof typeof WORKSPACE_TRANSPORT_CAPABILITIES
    ] ?? null
  );
}
`;
}

/**
 * @param {readonly Record<string, unknown>[]} manifests
 */
export function generateCatalogTransportSnapshotReaders(manifests) {
  /** @type {Set<string>} */
  const importLines = new Set();
  /** @type {string[]} */
  const bindingBlocks = [];

  for (const manifest of manifests) {
    const transport = resolveWorkspaceTransportManifest(manifest);
    if (transport === undefined || transport.supported !== true) {
      continue;
    }
    const caps = transport.capabilities ?? {};
    if (caps.catalogSnapshot !== true) {
      continue;
    }
    const reader = transport.catalogSnapshotReader;
    if (reader === undefined) {
      continue;
    }
    const workspaceType = manifest.workspaceTypes?.[0];
    if (typeof workspaceType !== "string" || workspaceType.trim().length === 0) {
      throw new Error(
        `workspace.manifest.json ${manifest.id}: workspaceTransport.catalogSnapshotReader requires workspaceTypes[0]`
      );
    }
    for (const key of ["module", "export"]) {
      if (typeof reader[key] !== "string" || reader[key].trim().length === 0) {
        throw new Error(
          `workspace.manifest.json ${manifest.id}: workspaceTransport.catalogSnapshotReader.${key} is required`
        );
      }
    }
    const alias = `${String(manifest.id).replace(/-/g, "_")}_transport_snapshot_reader`;
    const spec = importSpecifier(manifest.package, reader.module);
    importLines.add(`import { ${reader.export} as ${alias} } from "${spec}";`);
    bindingBlocks.push(`  {
    workspaceType: ${JSON.stringify(workspaceType)},
    readCatalogTransportSnapshot: ${alias},
  },`);
  }

  if (bindingBlocks.length === 0) {
    return `${BANNER}
import type { PublicCatalogTransportSnapshot } from "../tour/public-catalog-transport";

export type CatalogTransportSnapshotReaderBinding = {
  readonly workspaceType: string;
  readonly readCatalogTransportSnapshot: (
    data: Record<string, unknown>
  ) => PublicCatalogTransportSnapshot | undefined;
};

export const CATALOG_TRANSPORT_SNAPSHOT_READER_BINDINGS: readonly CatalogTransportSnapshotReaderBinding[] =
  [];

export function resolveCatalogTransportSnapshotReader(
  _workspaceType: string
): CatalogTransportSnapshotReaderBinding["readCatalogTransportSnapshot"] | undefined {
  return undefined;
}
`;
  }

  return `${BANNER}
import type { PublicCatalogTransportSnapshot } from "../tour/public-catalog-transport";
${[...importLines].join("\n")}

export type CatalogTransportSnapshotReaderBinding = {
  readonly workspaceType: string;
  readonly readCatalogTransportSnapshot: (
    data: Record<string, unknown>
  ) => PublicCatalogTransportSnapshot | undefined;
};

export const CATALOG_TRANSPORT_SNAPSHOT_READER_BINDINGS: readonly CatalogTransportSnapshotReaderBinding[] = [
${bindingBlocks.join("\n")}
] as const;

export function resolveCatalogTransportSnapshotReader(
  workspaceType: string
): CatalogTransportSnapshotReaderBinding["readCatalogTransportSnapshot"] | undefined {
  const binding = CATALOG_TRANSPORT_SNAPSHOT_READER_BINDINGS.find(
    (entry) => entry.workspaceType === workspaceType
  );
  return binding?.readCatalogTransportSnapshot;
}
`;
}

/**
 * @param {readonly Record<string, unknown>[]} manifests
 */
export function generateCatalogIntakeTransportSurfaces(manifests) {
  /** @type {Set<string>} */
  const importLines = new Set();
  /** @type {string[]} */
  const bindingBlocks = [];

  for (const manifest of manifests) {
    const transport = resolveWorkspaceTransportManifest(manifest);
    if (transport === undefined || transport.supported !== true) {
      continue;
    }
    const caps = transport.capabilities ?? {};
    if (caps.registrationIntake !== true) {
      continue;
    }
    const surface = transport.catalogIntakeTransportSurface;
    if (surface === undefined) {
      continue;
    }
    const workspaceType = manifest.workspaceTypes?.[0];
    if (typeof workspaceType !== "string" || workspaceType.trim().length === 0) {
      throw new Error(
        `workspace.manifest.json ${manifest.id}: workspaceTransport.catalogIntakeTransportSurface requires workspaceTypes[0]`
      );
    }
    for (const key of ["module", "export"]) {
      if (typeof surface[key] !== "string" || surface[key].trim().length === 0) {
        throw new Error(
          `workspace.manifest.json ${manifest.id}: workspaceTransport.catalogIntakeTransportSurface.${key} is required`
        );
      }
    }
    const alias = `${String(manifest.id).replace(/-/g, "_")}_transport_intake_surface`;
    const spec = importSpecifier(manifest.package, surface.module);
    importLines.add(`import { ${surface.export} as ${alias} } from "${spec}";`);
    bindingBlocks.push(`  {
    workspaceType: ${JSON.stringify(workspaceType)},
    transportIntakeSurface: ${alias},
  },`);
  }

  if (bindingBlocks.length === 0) {
    return `${BANNER}
import type { WorkspaceCatalogIntakeTransportSurface } from "./catalog-intake-transport-surface";

export type CatalogIntakeTransportSurfaceBinding = {
  readonly workspaceType: string;
  readonly transportIntakeSurface: WorkspaceCatalogIntakeTransportSurface;
};

export const CATALOG_INTAKE_TRANSPORT_SURFACE_BINDINGS: readonly CatalogIntakeTransportSurfaceBinding[] =
  [];

export function resolveCatalogIntakeTransportSurface(
  _workspaceType: string
): WorkspaceCatalogIntakeTransportSurface | undefined {
  return undefined;
}
`;
  }

  return `${BANNER}
import type { WorkspaceCatalogIntakeTransportSurface } from "./catalog-intake-transport-surface";
${[...importLines].join("\n")}

export type CatalogIntakeTransportSurfaceBinding = {
  readonly workspaceType: string;
  readonly transportIntakeSurface: WorkspaceCatalogIntakeTransportSurface;
};

export const CATALOG_INTAKE_TRANSPORT_SURFACE_BINDINGS: readonly CatalogIntakeTransportSurfaceBinding[] = [
${bindingBlocks.join("\n")}
] as const;

export function resolveCatalogIntakeTransportSurface(
  workspaceType: string
): WorkspaceCatalogIntakeTransportSurface | undefined {
  const binding = CATALOG_INTAKE_TRANSPORT_SURFACE_BINDINGS.find(
    (entry) => entry.workspaceType === workspaceType
  );
  return binding?.transportIntakeSurface;
}
`;
}

/**
 * @param {readonly Record<string, unknown>[]} manifests
 */
export function generateRegistrationTransportNormalizers(manifests) {
  /** @type {Set<string>} */
  const importLines = new Set();
  /** @type {string[]} */
  const bindingBlocks = [];

  for (const manifest of manifests) {
    const transport = resolveWorkspaceTransportManifest(manifest);
    if (transport === undefined || transport.supported !== true) {
      continue;
    }
    const caps = transport.capabilities ?? {};
    if (caps.registrationNormalize !== true) {
      continue;
    }
    const normalizer = transport.registrationTransportNormalizer;
    if (normalizer === undefined) {
      continue;
    }
    const workspaceType = manifest.workspaceTypes?.[0];
    if (typeof workspaceType !== "string" || workspaceType.trim().length === 0) {
      throw new Error(
        `workspace.manifest.json ${manifest.id}: workspaceTransport.registrationTransportNormalizer requires workspaceTypes[0]`
      );
    }
    for (const key of ["module", "export"]) {
      if (typeof normalizer[key] !== "string" || normalizer[key].trim().length === 0) {
        throw new Error(
          `workspace.manifest.json ${manifest.id}: workspaceTransport.registrationTransportNormalizer.${key} is required`
        );
      }
    }
    const alias = `${String(manifest.id).replace(/-/g, "_")}_transport_normalizer`;
    const spec = importSpecifier(manifest.package, normalizer.module);
    importLines.add(`import { ${normalizer.export} as ${alias} } from "${spec}";`);
    bindingBlocks.push(`  {
    workspaceType: ${JSON.stringify(workspaceType)},
    normalizeRegistrationTransportIntake: ${alias},
  },`);
  }

  if (bindingBlocks.length === 0) {
    return `${BANNER}
export type RegistrationTransportNormalizerBinding = {
  readonly workspaceType: string;
  readonly normalizeRegistrationTransportIntake: (...args: never[]) => unknown;
};

export const REGISTRATION_TRANSPORT_NORMALIZER_BINDINGS: readonly RegistrationTransportNormalizerBinding[] =
  [];

export function resolveRegistrationTransportNormalizer(
  _workspaceType: string
): RegistrationTransportNormalizerBinding["normalizeRegistrationTransportIntake"] | undefined {
  return undefined;
}
`;
  }

  return `${BANNER}
${[...importLines].join("\n")}

export type RegistrationTransportNormalizerBinding = {
  readonly workspaceType: string;
  readonly normalizeRegistrationTransportIntake: (...args: never[]) => unknown;
};

export const REGISTRATION_TRANSPORT_NORMALIZER_BINDINGS: readonly RegistrationTransportNormalizerBinding[] = [
${bindingBlocks.join("\n")}
] as const;

export function resolveRegistrationTransportNormalizer(
  workspaceType: string
): RegistrationTransportNormalizerBinding["normalizeRegistrationTransportIntake"] | undefined {
  const binding = REGISTRATION_TRANSPORT_NORMALIZER_BINDINGS.find(
    (entry) => entry.workspaceType === workspaceType
  );
  return binding?.normalizeRegistrationTransportIntake;
}
`;
}

/**
 * @param {readonly Record<string, unknown>[]} manifests
 */
export function generateWorkspaceRegistrationTransportInitializers(manifests) {
  for (const manifest of manifests) {
    assertWorkspaceTransportManifest(manifest);
  }

  /** @type {Set<string>} */
  const importLines = new Set();
  /** @type {string[]} */
  const callLines = [];

  for (const manifest of manifests) {
    const initializer = resolveTransportRegistrationInitializerExport(manifest);
    if (initializer === undefined) {
      continue;
    }
    const spec = importSpecifier(manifest.package, initializer.module);
    importLines.add(`import { ${initializer.export} } from "${spec}";`);
    callLines.push(`  ${initializer.export}();`);
  }

  const body =
    callLines.length > 0
      ? callLines.join("\n")
      : "  // no workspace declares workspaceTransport.registrationInitializer";

  return `${BANNER}
${[...importLines].sort().join("\n")}

export function registerWorkspaceRegistrationTransportInitializersFromManifest(): void {
${body}
}
`;
}

/**
 * @param {readonly Record<string, unknown>[]} manifests
 */
export function generateWorkspaceTransportBindings(manifests) {
  return {
    capabilities: generateWorkspaceTransportCapabilities(manifests),
    catalogSnapshotReaders: generateCatalogTransportSnapshotReaders(manifests),
    catalogIntakeTransportSurfaces: generateCatalogIntakeTransportSurfaces(manifests),
    registrationTransportNormalizers: generateRegistrationTransportNormalizers(manifests),
    registrationTransportInitializers: generateWorkspaceRegistrationTransportInitializers(manifests),
  };
}

/** Test / legacy aliases — singular Binding suffix. */
export const generateCatalogTransportSnapshotReaderBindings = generateCatalogTransportSnapshotReaders;
export const generateCatalogIntakeTransportSurfaceBindings = generateCatalogIntakeTransportSurfaces;
export const generateRegistrationTransportNormalizerBindings = generateRegistrationTransportNormalizers;
