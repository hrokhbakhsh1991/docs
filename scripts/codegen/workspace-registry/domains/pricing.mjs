import { BANNER } from "../constants.mjs";
import { importSpecifier } from "../utils.mjs";

const PRICING_SURFACE_KEYS = ["wizardTourField"];

/**
 * @param {Record<string, unknown>} manifest
 */
export function resolveWorkspacePricingManifest(manifest) {
  return manifest.workspacePricing;
}

/**
 * @param {Record<string, unknown>} manifest
 */
export function assertWorkspacePricingManifest(manifest) {
  const pricing = resolveWorkspacePricingManifest(manifest);
  if (pricing === undefined) {
    return;
  }
  if (typeof pricing !== "object" || pricing === null || Array.isArray(pricing)) {
    throw new Error(`workspace.manifest.json ${manifest.id}: workspacePricing must be an object`);
  }
  if (typeof pricing.supported !== "boolean") {
    throw new Error(`workspace.manifest.json ${manifest.id}: workspacePricing.supported must be boolean`);
  }
  if (pricing.supported === false) {
    for (const key of ["fieldModule", "wizardComposite"]) {
      if (pricing[key] !== undefined) {
        throw new Error(
          `workspace.manifest.json ${manifest.id}: workspacePricing.supported=false forbids ${key}`
        );
      }
    }
    return;
  }

  const caps = pricing.capabilities ?? {};
  if (typeof caps !== "object" || caps === null || Array.isArray(caps)) {
    throw new Error(`workspace.manifest.json ${manifest.id}: workspacePricing.capabilities must be an object`);
  }
  for (const key of PRICING_SURFACE_KEYS) {
    if (caps[key] !== undefined && typeof caps[key] !== "boolean") {
      throw new Error(
        `workspace.manifest.json ${manifest.id}: workspacePricing.capabilities.${key} must be boolean`
      );
    }
  }

  if (caps.wizardTourField === true) {
    if (pricing.fieldModule === undefined) {
      throw new Error(
        `workspace.manifest.json ${manifest.id}: capabilities.wizardTourField requires fieldModule`
      );
    }
    if (pricing.wizardComposite === undefined) {
      throw new Error(
        `workspace.manifest.json ${manifest.id}: capabilities.wizardTourField requires wizardComposite`
      );
    }
  }
}

/**
 * @param {Record<string, unknown>} pricing
 */
function resolvePricingSurfaceFlags(pricing) {
  const caps = pricing.capabilities ?? {};
  return Object.fromEntries(PRICING_SURFACE_KEYS.map((key) => [key, caps[key] === true]));
}

/**
 * @param {readonly Record<string, unknown>[]} manifests
 */
export function generateWorkspacePricingCapabilities(manifests) {
  /** @type {string[]} */
  const entries = [];

  for (const manifest of manifests) {
    assertWorkspacePricingManifest(manifest);
    const pricing = resolveWorkspacePricingManifest(manifest);
    if (pricing === undefined || pricing.supported !== true) {
      continue;
    }
    const workspaceTypes = Array.isArray(manifest.workspaceTypes) ? manifest.workspaceTypes : [];
    const surfaces = resolvePricingSurfaceFlags(pricing);
    for (const workspaceType of workspaceTypes) {
      if (typeof workspaceType !== "string" || workspaceType.trim().length === 0) {
        continue;
      }
      entries.push(`  ${JSON.stringify(workspaceType)}: {
    supported: true as const,
    wizardTourField: ${surfaces.wizardTourField ? "true" : "false"} as const,
  },`);
    }
  }

  if (entries.length === 0) {
    return `${BANNER}
export type WorkspacePricingCapabilities = {
  readonly supported: true;
  readonly wizardTourField: boolean;
};

export const WORKSPACE_PRICING_CAPABILITIES = {} as const;

export function getWorkspacePricingCapabilities(
  _workspaceType: string
): WorkspacePricingCapabilities | null {
  return null;
}
`;
  }

  return `${BANNER}
export type WorkspacePricingCapabilities = {
  readonly supported: true;
  readonly wizardTourField: boolean;
};

export const WORKSPACE_PRICING_CAPABILITIES = {
${entries.join("\n")}
} as const satisfies Record<string, WorkspacePricingCapabilities>;

export function getWorkspacePricingCapabilities(
  workspaceType: string
): WorkspacePricingCapabilities | null {
  return (
    WORKSPACE_PRICING_CAPABILITIES[
      workspaceType as keyof typeof WORKSPACE_PRICING_CAPABILITIES
    ] ?? null
  );
}
`;
}

/**
 * @param {readonly Record<string, unknown>[]} manifests
 */
export function generateWorkspacePricingFieldModuleBindings(manifests) {
  /** @type {Set<string>} */
  const importLines = new Set();
  /** @type {string[]} */
  const bindingBlocks = [];

  for (const manifest of manifests) {
    const pricing = resolveWorkspacePricingManifest(manifest);
    if (pricing === undefined || pricing.supported !== true) {
      continue;
    }
    const caps = pricing.capabilities ?? {};
    if (caps.wizardTourField !== true) {
      continue;
    }
    const fieldModule = pricing.fieldModule;
    if (fieldModule === undefined) {
      continue;
    }
    const workspaceType = manifest.workspaceTypes?.[0];
    if (typeof workspaceType !== "string" || workspaceType.trim().length === 0) {
      throw new Error(
        `workspace.manifest.json ${manifest.id}: workspacePricing.fieldModule requires workspaceTypes[0]`
      );
    }
    for (const key of ["module", "export"]) {
      if (typeof fieldModule[key] !== "string" || fieldModule[key].trim().length === 0) {
        throw new Error(
          `workspace.manifest.json ${manifest.id}: workspacePricing.fieldModule.${key} is required`
        );
      }
    }
    const alias = `${String(manifest.id).replace(/-/g, "_")}_pricing_field_module`;
    const spec = importSpecifier(manifest.package, fieldModule.module);
    importLines.add(`import { ${fieldModule.export} as ${alias} } from "${spec}";`);
    bindingBlocks.push(`  {
    workspaceType: ${JSON.stringify(workspaceType)},
    fieldRegistryFragment: ${alias},
  },`);
  }

  if (bindingBlocks.length === 0) {
    return `${BANNER}
import type { WorkspacePricingFieldRegistryFragment } from "@app-tour/workspace-sdk/pricing";

export type WorkspacePricingFieldModuleBinding = {
  readonly workspaceType: string;
  readonly fieldRegistryFragment: WorkspacePricingFieldRegistryFragment;
};

export const WORKSPACE_PRICING_FIELD_MODULE_BINDINGS: readonly WorkspacePricingFieldModuleBinding[] =
  [];

export function resolveWorkspacePricingFieldRegistryFragment(
  _workspaceType: string
): WorkspacePricingFieldRegistryFragment | undefined {
  return undefined;
}
`;
  }

  return `${BANNER}
import type { WorkspacePricingFieldRegistryFragment } from "@app-tour/workspace-sdk/pricing";
${[...importLines].join("\n")}

export type WorkspacePricingFieldModuleBinding = {
  readonly workspaceType: string;
  readonly fieldRegistryFragment: WorkspacePricingFieldRegistryFragment;
};

export const WORKSPACE_PRICING_FIELD_MODULE_BINDINGS: readonly WorkspacePricingFieldModuleBinding[] = [
${bindingBlocks.join("\n")}
] as const;

export function resolveWorkspacePricingFieldRegistryFragment(
  workspaceType: string
): WorkspacePricingFieldRegistryFragment | undefined {
  const binding = WORKSPACE_PRICING_FIELD_MODULE_BINDINGS.find(
    (entry) => entry.workspaceType === workspaceType
  );
  return binding?.fieldRegistryFragment;
}
`;
}

/**
 * @param {readonly Record<string, unknown>[]} manifests
 */
export function generateWorkspacePricingWizardCompositeBindings(manifests) {
  /** @type {Set<string>} */
  const importLines = new Set();
  /** @type {string[]} */
  const bindingBlocks = [];

  for (const manifest of manifests) {
    const pricing = resolveWorkspacePricingManifest(manifest);
    if (pricing === undefined || pricing.supported !== true) {
      continue;
    }
    const caps = pricing.capabilities ?? {};
    if (caps.wizardTourField !== true) {
      continue;
    }
    const wizardComposite = pricing.wizardComposite;
    if (wizardComposite === undefined) {
      continue;
    }
    const workspaceType = manifest.workspaceTypes?.[0];
    if (typeof workspaceType !== "string" || workspaceType.trim().length === 0) {
      throw new Error(
        `workspace.manifest.json ${manifest.id}: workspacePricing.wizardComposite requires workspaceTypes[0]`
      );
    }
    for (const key of ["module", "export"]) {
      if (typeof wizardComposite[key] !== "string" || wizardComposite[key].trim().length === 0) {
        throw new Error(
          `workspace.manifest.json ${manifest.id}: workspacePricing.wizardComposite.${key} is required`
        );
      }
    }
    const alias = `${String(manifest.id).replace(/-/g, "_")}_pricing_wizard_composite`;
    const spec = importSpecifier(manifest.package, wizardComposite.module);
    importLines.add(`import { ${wizardComposite.export} as ${alias} } from "${spec}";`);
    bindingBlocks.push(`  {
    workspaceType: ${JSON.stringify(workspaceType)},
    wizardCompositeBinding: ${alias},
  },`);
  }

  if (bindingBlocks.length === 0) {
    return `${BANNER}
import type { WorkspacePricingWizardCompositeBinding } from "@app-tour/workspace-sdk/pricing";

export type WorkspacePricingWizardCompositeBindingEntry = {
  readonly workspaceType: string;
  readonly wizardCompositeBinding: WorkspacePricingWizardCompositeBinding;
};

export const WORKSPACE_PRICING_WIZARD_COMPOSITE_BINDINGS: readonly WorkspacePricingWizardCompositeBindingEntry[] =
  [];

export function resolveWorkspacePricingWizardCompositeBinding(
  _workspaceType: string
): WorkspacePricingWizardCompositeBinding | undefined {
  return undefined;
}
`;
  }

  return `${BANNER}
import type { WorkspacePricingWizardCompositeBinding } from "@app-tour/workspace-sdk/pricing";
${[...importLines].join("\n")}

export type WorkspacePricingWizardCompositeBindingEntry = {
  readonly workspaceType: string;
  readonly wizardCompositeBinding: WorkspacePricingWizardCompositeBinding;
};

export const WORKSPACE_PRICING_WIZARD_COMPOSITE_BINDINGS: readonly WorkspacePricingWizardCompositeBindingEntry[] = [
${bindingBlocks.join("\n")}
] as const;

export function resolveWorkspacePricingWizardCompositeBinding(
  workspaceType: string
): WorkspacePricingWizardCompositeBinding | undefined {
  const binding = WORKSPACE_PRICING_WIZARD_COMPOSITE_BINDINGS.find(
    (entry) => entry.workspaceType === workspaceType
  );
  return binding?.wizardCompositeBinding;
}
`;
}

/**
 * @param {readonly Record<string, unknown>[]} manifests
 */
export function generateWorkspacePricingBindings(manifests) {
  return {
    capabilities: generateWorkspacePricingCapabilities(manifests),
    fieldModule: generateWorkspacePricingFieldModuleBindings(manifests),
    wizardComposite: generateWorkspacePricingWizardCompositeBindings(manifests),
  };
}
