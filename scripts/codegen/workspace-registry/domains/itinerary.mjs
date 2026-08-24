import { BANNER } from "../constants.mjs";
import { importSpecifier } from "../utils.mjs";

const ITINERARY_SURFACE_KEYS = ["wizardTourField", "catalogDetailSection"];

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
 * @param {Record<string, unknown>} manifest
 */
export function resolveWorkspaceItineraryManifest(manifest) {
  return manifest.workspaceItinerary;
}

/**
 * @param {Record<string, unknown>} manifest
 */
export function assertWorkspaceItineraryManifest(manifest) {
  const itinerary = resolveWorkspaceItineraryManifest(manifest);
  if (itinerary === undefined) {
    return;
  }
  if (typeof itinerary !== "object" || itinerary === null || Array.isArray(itinerary)) {
    throw new Error(`workspace.manifest.json ${manifest.id}: workspaceItinerary must be an object`);
  }
  if (typeof itinerary.supported !== "boolean") {
    throw new Error(`workspace.manifest.json ${manifest.id}: workspaceItinerary.supported must be boolean`);
  }
  if (itinerary.supported === false) {
    for (const key of ["fieldModule", "wizardComposite"]) {
      if (itinerary[key] !== undefined) {
        throw new Error(
          `workspace.manifest.json ${manifest.id}: workspaceItinerary.supported=false forbids ${key}`
        );
      }
    }
    return;
  }

  const caps = itinerary.capabilities ?? {};
  if (typeof caps !== "object" || caps === null || Array.isArray(caps)) {
    throw new Error(`workspace.manifest.json ${manifest.id}: workspaceItinerary.capabilities must be an object`);
  }
  for (const key of ITINERARY_SURFACE_KEYS) {
    if (caps[key] !== undefined && typeof caps[key] !== "boolean") {
      throw new Error(
        `workspace.manifest.json ${manifest.id}: workspaceItinerary.capabilities.${key} must be boolean`
      );
    }
  }

  if (caps.catalogDetailSection === true) {
    const presentation = readCatalogPresentation(manifest);
    const detailSections = presentation?.detailSections ?? {};
    if (detailSections.itinerary !== true) {
      throw new Error(
        `workspace.manifest.json ${manifest.id}: capabilities.catalogDetailSection requires catalogPresentation.detailSections.itinerary`
      );
    }
  }

  if (caps.wizardTourField === true) {
    if (itinerary.fieldModule === undefined) {
      throw new Error(
        `workspace.manifest.json ${manifest.id}: capabilities.wizardTourField requires fieldModule`
      );
    }
    if (itinerary.wizardComposite === undefined) {
      throw new Error(
        `workspace.manifest.json ${manifest.id}: capabilities.wizardTourField requires wizardComposite`
      );
    }
  }
}

/**
 * @param {Record<string, unknown>} itinerary
 */
function resolveItinerarySurfaceFlags(itinerary) {
  const caps = itinerary.capabilities ?? {};
  return Object.fromEntries(ITINERARY_SURFACE_KEYS.map((key) => [key, caps[key] === true]));
}

/**
 * @param {readonly Record<string, unknown>[]} manifests
 */
export function generateWorkspaceItineraryCapabilities(manifests) {
  /** @type {string[]} */
  const entries = [];

  for (const manifest of manifests) {
    assertWorkspaceItineraryManifest(manifest);
    const itinerary = resolveWorkspaceItineraryManifest(manifest);
    if (itinerary === undefined || itinerary.supported !== true) {
      continue;
    }
    const workspaceTypes = Array.isArray(manifest.workspaceTypes) ? manifest.workspaceTypes : [];
    const surfaces = resolveItinerarySurfaceFlags(itinerary);
    for (const workspaceType of workspaceTypes) {
      if (typeof workspaceType !== "string" || workspaceType.trim().length === 0) {
        continue;
      }
      entries.push(`  ${JSON.stringify(workspaceType)}: {
    supported: true as const,
    wizardTourField: ${surfaces.wizardTourField ? "true" : "false"} as const,
    catalogDetailSection: ${surfaces.catalogDetailSection ? "true" : "false"} as const,
  },`);
    }
  }

  if (entries.length === 0) {
    return `${BANNER}
export type WorkspaceItineraryCapabilities = {
  readonly supported: true;
  readonly wizardTourField: boolean;
  readonly catalogDetailSection: boolean;
};

export const WORKSPACE_ITINERARY_CAPABILITIES = {} as const;

export function getWorkspaceItineraryCapabilities(
  _workspaceType: string
): WorkspaceItineraryCapabilities | null {
  return null;
}
`;
  }

  return `${BANNER}
export type WorkspaceItineraryCapabilities = {
  readonly supported: true;
  readonly wizardTourField: boolean;
  readonly catalogDetailSection: boolean;
};

export const WORKSPACE_ITINERARY_CAPABILITIES = {
${entries.join("\n")}
} as const satisfies Record<string, WorkspaceItineraryCapabilities>;

export function getWorkspaceItineraryCapabilities(
  workspaceType: string
): WorkspaceItineraryCapabilities | null {
  return (
    WORKSPACE_ITINERARY_CAPABILITIES[
      workspaceType as keyof typeof WORKSPACE_ITINERARY_CAPABILITIES
    ] ?? null
  );
}
`;
}

/**
 * @param {readonly Record<string, unknown>[]} manifests
 */
export function generateWorkspaceItineraryFieldModuleBindings(manifests) {
  /** @type {Set<string>} */
  const importLines = new Set();
  /** @type {string[]} */
  const bindingBlocks = [];

  for (const manifest of manifests) {
    const itinerary = resolveWorkspaceItineraryManifest(manifest);
    if (itinerary === undefined || itinerary.supported !== true) {
      continue;
    }
    const caps = itinerary.capabilities ?? {};
    if (caps.wizardTourField !== true) {
      continue;
    }
    const fieldModule = itinerary.fieldModule;
    if (fieldModule === undefined) {
      continue;
    }
    const workspaceType = manifest.workspaceTypes?.[0];
    if (typeof workspaceType !== "string" || workspaceType.trim().length === 0) {
      throw new Error(
        `workspace.manifest.json ${manifest.id}: workspaceItinerary.fieldModule requires workspaceTypes[0]`
      );
    }
    for (const key of ["module", "export"]) {
      if (typeof fieldModule[key] !== "string" || fieldModule[key].trim().length === 0) {
        throw new Error(
          `workspace.manifest.json ${manifest.id}: workspaceItinerary.fieldModule.${key} is required`
        );
      }
    }
    const alias = `${String(manifest.id).replace(/-/g, "_")}_itinerary_field_module`;
    const spec = importSpecifier(manifest.package, fieldModule.module);
    importLines.add(`import { ${fieldModule.export} as ${alias} } from "${spec}";`);
    bindingBlocks.push(`  {
    workspaceType: ${JSON.stringify(workspaceType)},
    fieldRegistryFragment: ${alias},
  },`);
  }

  if (bindingBlocks.length === 0) {
    return `${BANNER}
import type { WorkspaceItineraryFieldRegistryFragment } from "@app-tour/workspace-sdk/itinerary";

export type WorkspaceItineraryFieldModuleBinding = {
  readonly workspaceType: string;
  readonly fieldRegistryFragment: WorkspaceItineraryFieldRegistryFragment;
};

export const WORKSPACE_ITINERARY_FIELD_MODULE_BINDINGS: readonly WorkspaceItineraryFieldModuleBinding[] =
  [];

export function resolveWorkspaceItineraryFieldRegistryFragment(
  _workspaceType: string
): WorkspaceItineraryFieldRegistryFragment | undefined {
  return undefined;
}
`;
  }

  return `${BANNER}
import type { WorkspaceItineraryFieldRegistryFragment } from "@app-tour/workspace-sdk/itinerary";
${[...importLines].join("\n")}

export type WorkspaceItineraryFieldModuleBinding = {
  readonly workspaceType: string;
  readonly fieldRegistryFragment: WorkspaceItineraryFieldRegistryFragment;
};

export const WORKSPACE_ITINERARY_FIELD_MODULE_BINDINGS: readonly WorkspaceItineraryFieldModuleBinding[] = [
${bindingBlocks.join("\n")}
] as const;

export function resolveWorkspaceItineraryFieldRegistryFragment(
  workspaceType: string
): WorkspaceItineraryFieldRegistryFragment | undefined {
  const binding = WORKSPACE_ITINERARY_FIELD_MODULE_BINDINGS.find(
    (entry) => entry.workspaceType === workspaceType
  );
  return binding?.fieldRegistryFragment;
}
`;
}

/**
 * @param {readonly Record<string, unknown>[]} manifests
 */
export function generateWorkspaceItineraryWizardCompositeBindings(manifests) {
  /** @type {Set<string>} */
  const importLines = new Set();
  /** @type {string[]} */
  const bindingBlocks = [];

  for (const manifest of manifests) {
    const itinerary = resolveWorkspaceItineraryManifest(manifest);
    if (itinerary === undefined || itinerary.supported !== true) {
      continue;
    }
    const caps = itinerary.capabilities ?? {};
    if (caps.wizardTourField !== true) {
      continue;
    }
    const wizardComposite = itinerary.wizardComposite;
    if (wizardComposite === undefined) {
      continue;
    }
    const workspaceType = manifest.workspaceTypes?.[0];
    if (typeof workspaceType !== "string" || workspaceType.trim().length === 0) {
      throw new Error(
        `workspace.manifest.json ${manifest.id}: workspaceItinerary.wizardComposite requires workspaceTypes[0]`
      );
    }
    for (const key of ["module", "export"]) {
      if (typeof wizardComposite[key] !== "string" || wizardComposite[key].trim().length === 0) {
        throw new Error(
          `workspace.manifest.json ${manifest.id}: workspaceItinerary.wizardComposite.${key} is required`
        );
      }
    }
    const alias = `${String(manifest.id).replace(/-/g, "_")}_itinerary_wizard_composite`;
    const spec = importSpecifier(manifest.package, wizardComposite.module);
    importLines.add(`import { ${wizardComposite.export} as ${alias} } from "${spec}";`);
    bindingBlocks.push(`  {
    workspaceType: ${JSON.stringify(workspaceType)},
    wizardCompositeBinding: ${alias},
  },`);
  }

  if (bindingBlocks.length === 0) {
    return `${BANNER}
import type { WorkspaceItineraryWizardCompositeBinding } from "@app-tour/workspace-sdk/itinerary";

export type WorkspaceItineraryWizardCompositeBindingEntry = {
  readonly workspaceType: string;
  readonly wizardCompositeBinding: WorkspaceItineraryWizardCompositeBinding;
};

export const WORKSPACE_ITINERARY_WIZARD_COMPOSITE_BINDINGS: readonly WorkspaceItineraryWizardCompositeBindingEntry[] =
  [];

export function resolveWorkspaceItineraryWizardCompositeBinding(
  _workspaceType: string
): WorkspaceItineraryWizardCompositeBinding | undefined {
  return undefined;
}
`;
  }

  return `${BANNER}
import type { WorkspaceItineraryWizardCompositeBinding } from "@app-tour/workspace-sdk/itinerary";
${[...importLines].join("\n")}

export type WorkspaceItineraryWizardCompositeBindingEntry = {
  readonly workspaceType: string;
  readonly wizardCompositeBinding: WorkspaceItineraryWizardCompositeBinding;
};

export const WORKSPACE_ITINERARY_WIZARD_COMPOSITE_BINDINGS: readonly WorkspaceItineraryWizardCompositeBindingEntry[] = [
${bindingBlocks.join("\n")}
] as const;

export function resolveWorkspaceItineraryWizardCompositeBinding(
  workspaceType: string
): WorkspaceItineraryWizardCompositeBinding | undefined {
  const binding = WORKSPACE_ITINERARY_WIZARD_COMPOSITE_BINDINGS.find(
    (entry) => entry.workspaceType === workspaceType
  );
  return binding?.wizardCompositeBinding;
}
`;
}

/**
 * @param {readonly Record<string, unknown>[]} manifests
 */
export function generateWorkspaceItineraryBindings(manifests) {
  return {
    capabilities: generateWorkspaceItineraryCapabilities(manifests),
    fieldModule: generateWorkspaceItineraryFieldModuleBindings(manifests),
    wizardComposite: generateWorkspaceItineraryWizardCompositeBindings(manifests),
  };
}
