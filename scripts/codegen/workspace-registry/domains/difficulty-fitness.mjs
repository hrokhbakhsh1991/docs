import { BANNER } from "../constants.mjs";
import { importSpecifier } from "../utils.mjs";

const DIFFICULTY_FITNESS_SURFACE_KEYS = [
  "wizardTourField",
  "catalogDetailSection",
  "catalogListFilters",
  "catalogMarketingFilters",
];

/**
 * @param {Record<string, unknown>} manifest
 */
function readCatalogPresentation(manifest) {
  const presentation = manifest.catalogPresentation;
  if (presentation === undefined || typeof presentation !== "object" || presentation === null) {
    return undefined;
  }
  return presentation;
}

/**
 * Resolve workspaceDifficultyFitness block with legacy Denali alias from catalogPresentation.
 *
 * @param {Record<string, unknown>} manifest
 */
export function resolveWorkspaceDifficultyFitnessManifest(manifest) {
  const block = manifest.workspaceDifficultyFitness;
  if (block !== undefined) {
    return block;
  }
  if (manifest.id !== "denali") {
    return undefined;
  }
  const presentation = readCatalogPresentation(manifest);
  const detailSections = presentation?.detailSections;
  const listFeatures = presentation?.listFeatures;
  const serverListFilters = Array.isArray(listFeatures?.serverListFilters)
    ? listFeatures.serverListFilters
    : [];
  const hasDetail =
    detailSections?.difficulty === true || detailSections?.fitness === true;
  const hasListFilters =
    serverListFilters.includes("difficulty") || serverListFilters.includes("fitness");
  if (!hasDetail && !hasListFilters) {
    return undefined;
  }
  return {
    supported: true,
    capabilities: {
      wizardTourField: false,
      catalogDetailSection: hasDetail,
      catalogListFilters: hasListFilters,
      catalogMarketingFilters: hasListFilters,
    },
  };
}

/**
 * @param {Record<string, unknown>} manifest
 */
export function assertWorkspaceDifficultyFitnessManifest(manifest) {
  const difficultyFitness = resolveWorkspaceDifficultyFitnessManifest(manifest);
  if (difficultyFitness === undefined) {
    return;
  }
  if (
    typeof difficultyFitness !== "object" ||
    difficultyFitness === null ||
    Array.isArray(difficultyFitness)
  ) {
    throw new Error(
      `workspace.manifest.json ${manifest.id}: workspaceDifficultyFitness must be an object`
    );
  }
  if (typeof difficultyFitness.supported !== "boolean") {
    throw new Error(
      `workspace.manifest.json ${manifest.id}: workspaceDifficultyFitness.supported must be boolean`
    );
  }
  if (difficultyFitness.supported === false) {
    for (const key of ["fieldModule", "filterPresentation"]) {
      if (difficultyFitness[key] !== undefined) {
        throw new Error(
          `workspace.manifest.json ${manifest.id}: workspaceDifficultyFitness.supported=false forbids ${key}`
        );
      }
    }
    return;
  }

  const caps = difficultyFitness.capabilities ?? {};
  if (typeof caps !== "object" || caps === null || Array.isArray(caps)) {
    throw new Error(
      `workspace.manifest.json ${manifest.id}: workspaceDifficultyFitness.capabilities must be an object`
    );
  }
  for (const key of DIFFICULTY_FITNESS_SURFACE_KEYS) {
    if (caps[key] !== undefined && typeof caps[key] !== "boolean") {
      throw new Error(
        `workspace.manifest.json ${manifest.id}: workspaceDifficultyFitness.capabilities.${key} must be boolean`
      );
    }
  }

  const presentation = readCatalogPresentation(manifest);
  const detailSections = presentation?.detailSections ?? {};
  const serverListFilters = Array.isArray(presentation?.listFeatures?.serverListFilters)
    ? presentation.listFeatures.serverListFilters
    : [];

  if (caps.catalogDetailSection === true) {
    if (detailSections.difficulty !== true && detailSections.fitness !== true) {
      throw new Error(
        `${manifest.id}: workspaceDifficultyFitness.capabilities.catalogDetailSection requires catalogPresentation.detailSections.difficulty or fitness`
      );
    }
  }
  if (caps.catalogListFilters === true) {
    if (!serverListFilters.includes("difficulty") && !serverListFilters.includes("fitness")) {
      throw new Error(
        `${manifest.id}: workspaceDifficultyFitness.capabilities.catalogListFilters requires difficulty or fitness in catalogPresentation.listFeatures.serverListFilters`
      );
    }
  }
  if (caps.catalogMarketingFilters === true && difficultyFitness.filterPresentation === undefined) {
    throw new Error(
      `${manifest.id}: workspaceDifficultyFitness.capabilities.catalogMarketingFilters requires filterPresentation`
    );
  }
  if (caps.wizardTourField === true && difficultyFitness.fieldModule === undefined) {
    throw new Error(
      `${manifest.id}: workspaceDifficultyFitness.capabilities.wizardTourField requires fieldModule`
    );
  }
}

/**
 * @param {Record<string, unknown>} difficultyFitness
 */
function resolveDifficultyFitnessSurfaceFlags(difficultyFitness) {
  const caps = difficultyFitness.capabilities ?? {};
  return Object.fromEntries(
    DIFFICULTY_FITNESS_SURFACE_KEYS.map((key) => [key, caps[key] === true])
  );
}

/**
 * @param {readonly Record<string, unknown>[]} manifests
 */
export function generateWorkspaceDifficultyFitnessCapabilities(manifests) {
  /** @type {string[]} */
  const entries = [];

  for (const manifest of manifests) {
    assertWorkspaceDifficultyFitnessManifest(manifest);
    const difficultyFitness = resolveWorkspaceDifficultyFitnessManifest(manifest);
    if (difficultyFitness === undefined || difficultyFitness.supported !== true) {
      continue;
    }
    const workspaceTypes = Array.isArray(manifest.workspaceTypes) ? manifest.workspaceTypes : [];
    const surfaces = resolveDifficultyFitnessSurfaceFlags(difficultyFitness);
    for (const workspaceType of workspaceTypes) {
      if (typeof workspaceType !== "string" || workspaceType.trim().length === 0) {
        continue;
      }
      entries.push(`  ${JSON.stringify(workspaceType)}: {
    supported: true as const,
    wizardTourField: ${surfaces.wizardTourField ? "true" : "false"} as const,
    catalogDetailSection: ${surfaces.catalogDetailSection ? "true" : "false"} as const,
    catalogListFilters: ${surfaces.catalogListFilters ? "true" : "false"} as const,
    catalogMarketingFilters: ${surfaces.catalogMarketingFilters ? "true" : "false"} as const,
  },`);
    }
  }

  if (entries.length === 0) {
    return `${BANNER}
export type WorkspaceDifficultyFitnessCapabilities = {
  readonly supported: true;
  readonly wizardTourField: boolean;
  readonly catalogDetailSection: boolean;
  readonly catalogListFilters: boolean;
  readonly catalogMarketingFilters: boolean;
};

export const WORKSPACE_DIFFICULTY_FITNESS_CAPABILITIES = {} as const;

export function getWorkspaceDifficultyFitnessCapabilities(
  _workspaceType: string
): WorkspaceDifficultyFitnessCapabilities | null {
  return null;
}
`;
  }

  return `${BANNER}
export type WorkspaceDifficultyFitnessCapabilities = {
  readonly supported: true;
  readonly wizardTourField: boolean;
  readonly catalogDetailSection: boolean;
  readonly catalogListFilters: boolean;
  readonly catalogMarketingFilters: boolean;
};

export const WORKSPACE_DIFFICULTY_FITNESS_CAPABILITIES = {
${entries.join("\n")}
} as const satisfies Record<string, WorkspaceDifficultyFitnessCapabilities>;

export function getWorkspaceDifficultyFitnessCapabilities(
  workspaceType: string
): WorkspaceDifficultyFitnessCapabilities | null {
  return (
  WORKSPACE_DIFFICULTY_FITNESS_CAPABILITIES[
    workspaceType as keyof typeof WORKSPACE_DIFFICULTY_FITNESS_CAPABILITIES
  ] ?? null
  );
}
`;
}

/**
 * CW7-09 — optional field-registry fragment bindings from workspaceDifficultyFitness.fieldModule.
 *
 * @param {readonly Record<string, unknown>[]} manifests
 */
export function generateWorkspaceDifficultyFitnessFieldModuleBindings(manifests) {
  /** @type {Set<string>} */
  const importLines = new Set();
  /** @type {string[]} */
  const bindingBlocks = [];

  for (const manifest of manifests) {
    const difficultyFitness = resolveWorkspaceDifficultyFitnessManifest(manifest);
    if (difficultyFitness === undefined || difficultyFitness.supported !== true) {
      continue;
    }
    const caps = difficultyFitness.capabilities ?? {};
    if (caps.wizardTourField !== true) {
      continue;
    }
    const fieldModule = difficultyFitness.fieldModule;
    if (fieldModule === undefined) {
      continue;
    }
    const workspaceType = manifest.workspaceTypes?.[0];
    if (typeof workspaceType !== "string" || workspaceType.trim().length === 0) {
      throw new Error(
        `workspace.manifest.json ${manifest.id}: workspaceDifficultyFitness.fieldModule requires workspaceTypes[0]`
      );
    }
    for (const key of ["module", "export"]) {
      if (typeof fieldModule[key] !== "string" || fieldModule[key].trim().length === 0) {
        throw new Error(
          `workspace.manifest.json ${manifest.id}: workspaceDifficultyFitness.fieldModule.${key} is required`
        );
      }
    }
    const alias = `${String(manifest.id).replace(/-/g, "_")}_difficulty_fitness_field_module`;
    const spec = importSpecifier(manifest.package, fieldModule.module);
    importLines.add(`import { ${fieldModule.export} as ${alias} } from "${spec}";`);
    bindingBlocks.push(`  {
    workspaceType: ${JSON.stringify(workspaceType)},
    fieldRegistryFragment: ${alias},
  },`);
  }

  if (bindingBlocks.length === 0) {
    return `${BANNER}
import type { WorkspaceDifficultyFitnessFieldRegistryFragment } from "../difficulty-fitness/workspace-difficulty-fitness-field-module";

export type WorkspaceDifficultyFitnessFieldModuleBinding = {
  readonly workspaceType: string;
  readonly fieldRegistryFragment: WorkspaceDifficultyFitnessFieldRegistryFragment;
};

export const WORKSPACE_DIFFICULTY_FITNESS_FIELD_MODULE_BINDINGS: readonly WorkspaceDifficultyFitnessFieldModuleBinding[] =
  [];

export function resolveWorkspaceDifficultyFitnessFieldRegistryFragment(
  _workspaceType: string
): WorkspaceDifficultyFitnessFieldRegistryFragment | undefined {
  return undefined;
}
`;
  }

  return `${BANNER}
import type { WorkspaceDifficultyFitnessFieldRegistryFragment } from "../difficulty-fitness/workspace-difficulty-fitness-field-module";
${[...importLines].join("\n")}

export type WorkspaceDifficultyFitnessFieldModuleBinding = {
  readonly workspaceType: string;
  readonly fieldRegistryFragment: WorkspaceDifficultyFitnessFieldRegistryFragment;
};

export const WORKSPACE_DIFFICULTY_FITNESS_FIELD_MODULE_BINDINGS: readonly WorkspaceDifficultyFitnessFieldModuleBinding[] = [
${bindingBlocks.join("\n")}
] as const;

export function resolveWorkspaceDifficultyFitnessFieldRegistryFragment(
  workspaceType: string
): WorkspaceDifficultyFitnessFieldRegistryFragment | undefined {
  const binding = WORKSPACE_DIFFICULTY_FITNESS_FIELD_MODULE_BINDINGS.find(
    (entry) => entry.workspaceType === workspaceType
  );
  return binding?.fieldRegistryFragment;
}
`;
}

/**
 * @param {readonly Record<string, unknown>[]} manifests
 */
export function generateWorkspaceDifficultyFitnessFilterPresentationBindings(manifests) {
  /** @type {string[]} */
  const idLiterals = [];
  /** @type {string[]} */
  const switchCases = [];

  for (const manifest of manifests) {
    const difficultyFitness = resolveWorkspaceDifficultyFitnessManifest(manifest);
    if (difficultyFitness === undefined || difficultyFitness.supported !== true) {
      continue;
    }
    const caps = difficultyFitness.capabilities ?? {};
    if (caps.catalogMarketingFilters !== true) {
      continue;
    }
    const filterPresentation = difficultyFitness.filterPresentation;
    if (filterPresentation === undefined) {
      continue;
    }
    const workspaceType = manifest.workspaceTypes?.[0];
    if (typeof workspaceType !== "string" || workspaceType.trim().length === 0) {
      throw new Error(
        `workspace.manifest.json ${manifest.id}: workspaceDifficultyFitness.filterPresentation requires workspaceTypes[0]`
      );
    }
    for (const key of ["module", "export"]) {
      if (typeof filterPresentation[key] !== "string" || filterPresentation[key].trim().length === 0) {
        throw new Error(
          `workspace.manifest.json ${manifest.id}: workspaceDifficultyFitness.filterPresentation.${key} is required`
        );
      }
    }
    const spec = importSpecifier(manifest.package, filterPresentation.module);
    idLiterals.push(JSON.stringify(workspaceType));
    switchCases.push(`    case ${JSON.stringify(workspaceType)}: {
      const mod = await import(${JSON.stringify(spec)});
      return mod.${filterPresentation.export};
    }`);
  }

  idLiterals.sort((a, b) => a.localeCompare(b));
  switchCases.sort((a, b) => a.localeCompare(b));

  if (switchCases.length === 0) {
    return `${BANNER}
import type { WorkspaceDifficultyFitnessFilterPresentation } from "../tour/public-catalog-difficulty-fitness";

const MARKETING_DIFFICULTY_FITNESS_WORKSPACE_TYPES = new Set<string>();

export async function resolveWorkspaceDifficultyFitnessFilterPresentation(
  _workspaceType: string
): Promise<WorkspaceDifficultyFitnessFilterPresentation | undefined> {
  return undefined;
}
`;
  }

  return `${BANNER}
import type { WorkspaceDifficultyFitnessFilterPresentation } from "../tour/public-catalog-difficulty-fitness";

const MARKETING_DIFFICULTY_FITNESS_WORKSPACE_TYPES = new Set<string>([
  ${idLiterals.join(",\n  ")}
]);

/** Lazy workspace-owned filter vocab — dynamic import only (CW7-09). */
export async function resolveWorkspaceDifficultyFitnessFilterPresentation(
  workspaceType: string
): Promise<WorkspaceDifficultyFitnessFilterPresentation | undefined> {
  if (!MARKETING_DIFFICULTY_FITNESS_WORKSPACE_TYPES.has(workspaceType)) {
    return undefined;
  }
  switch (workspaceType) {
${switchCases.join("\n")}
    default:
      return undefined;
  }
}
`;
}

/**
 * @param {readonly Record<string, unknown>[]} manifests
 */
export function generateWorkspaceDifficultyFitnessBindings(manifests) {
  return {
    capabilities: generateWorkspaceDifficultyFitnessCapabilities(manifests),
    fieldModule: generateWorkspaceDifficultyFitnessFieldModuleBindings(manifests),
    filterPresentation: generateWorkspaceDifficultyFitnessFilterPresentationBindings(manifests),
  };
}
