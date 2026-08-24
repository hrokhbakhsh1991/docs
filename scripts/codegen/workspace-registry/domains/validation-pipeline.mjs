import { BANNER } from "../constants.mjs";
import { importSpecifier } from "../utils.mjs";

import { resolveWorkspaceEquipmentManifest } from "./equipment.mjs";
import { resolveWorkspaceDifficultyFitnessManifest } from "./difficulty-fitness.mjs";
import { resolveWorkspaceItineraryManifest } from "./itinerary.mjs";
import { resolveWorkspacePricingManifest } from "./pricing.mjs";
import { resolveWorkspaceTransportManifest } from "./transport.mjs";

/**
 * Stable capability ordering for validation pipeline dispatch (CW8-02).
 *
 * @param {Record<string, unknown>} manifest
 * @returns {string[]}
 */
export function listEnabledCapabilityIds(manifest) {
  /** @type {string[]} */
  const ids = [];
  const booking = manifest.workspaceBooking;
  if (
    booking !== undefined &&
    typeof booking === "object" &&
    booking !== null &&
    booking.supported === true &&
    booking.capabilities?.validation?.enabled === true
  ) {
    ids.push("workspaceBooking");
  }
  const equipment = resolveWorkspaceEquipmentManifest(manifest);
  if (equipment !== undefined && equipment.supported === true) {
    ids.push("workspaceEquipment");
  }
  const transport = resolveWorkspaceTransportManifest(manifest);
  if (transport !== undefined && transport.supported === true) {
    ids.push("workspaceTransport");
  }
  const difficultyFitness = resolveWorkspaceDifficultyFitnessManifest(manifest);
  if (difficultyFitness !== undefined && difficultyFitness.supported === true) {
    ids.push("workspaceDifficultyFitness");
  }
  const itinerary = resolveWorkspaceItineraryManifest(manifest);
  if (itinerary !== undefined && itinerary.supported === true) {
    ids.push("workspaceItinerary");
  }
  const pricing = resolveWorkspacePricingManifest(manifest);
  if (pricing !== undefined && pricing.supported === true) {
    ids.push("workspacePricing");
  }
  const finance = manifest.workspaceFinance;
  if (finance !== undefined && typeof finance === "object" && finance !== null && finance.supported === true) {
    ids.push("workspaceFinance");
  }
  return ids.sort();
}

/**
 * @param {readonly Record<string, unknown>[]} manifests
 */
export function generateWorkspaceCapabilityValidationBindings(manifests) {
  /** @type {Set<string>} */
  const capabilityIds = new Set();
  for (const manifest of manifests) {
    for (const id of listEnabledCapabilityIds(manifest)) {
      capabilityIds.add(id);
    }
  }

  const orderedIds = [...capabilityIds].sort();
  if (orderedIds.length === 0) {
    return `${BANNER}
import type { WorkspaceValidationPipelineStage } from "@app-tour/workspace-sdk";

export type CapabilityValidatorBinding = {
  readonly capabilityId: string;
  readonly run: WorkspaceValidationPipelineStage;
};

/** Manifest-ordered capability validators — populated when capability ports wire in (CW8-04+). */
export const WORKSPACE_CAPABILITY_VALIDATORS: readonly CapabilityValidatorBinding[] = [];
`;
  }

  const bindingLines = orderedIds.map(
    (id) => `  {
    capabilityId: ${JSON.stringify(id)},
    run: (_ctx) => null,
  },`
  );

  return `${BANNER}
import type { WorkspaceValidationPipelineStage } from "@app-tour/workspace-sdk";

export type CapabilityValidatorBinding = {
  readonly capabilityId: string;
  readonly run: WorkspaceValidationPipelineStage;
};

/**
 * Manifest-ordered capability validator registry.
 * Rows are codegen-stable; runner skips empty list (no error).
 * Individual validators wire in CW8-04 (booking publish) / CW7-03 (equipment ids).
 */
export const WORKSPACE_CAPABILITY_VALIDATORS: readonly CapabilityValidatorBinding[] = [
${bindingLines.join("\n")}
];
`;
}

/**
 * CW8-03 — manifest workspacePolicy module bindings for workspacePolicyValidation stage.
 *
 * @param {readonly Record<string, unknown>[]} manifests
 */
export function generateWorkspacePolicyValidationBindings(manifests) {
  /** @type {Set<string>} */
  const importLines = new Set();
  /** @type {string[]} */
  const bindingBlocks = [];

  for (const manifest of manifests) {
    const policy = manifest.workspacePolicy;
    if (policy === undefined || typeof policy !== "object" || policy === null) {
      continue;
    }
    const workspaceType = manifest.workspaceTypes?.[0];
    if (typeof workspaceType !== "string" || workspaceType.trim().length === 0) {
      throw new Error(`workspace.manifest.json ${manifest.id}: workspacePolicy requires workspaceTypes[0]`);
    }
    for (const key of ["module", "export"]) {
      if (typeof policy[key] !== "string" || policy[key].trim().length === 0) {
        throw new Error(`workspace.manifest.json ${manifest.id}: workspacePolicy.${key} is required`);
      }
    }
    const alias = `${String(manifest.id).replace(/-/g, "_")}_workspace_policy`;
    const spec = importSpecifier(manifest.package, policy.module);
    importLines.add(`import { ${policy.export} as ${alias} } from "${spec}";`);
    bindingBlocks.push(`  {
    workspaceType: ${JSON.stringify(workspaceType)},
    createValidator: ${alias},
  },`);
  }

  if (bindingBlocks.length === 0) {
    return `${BANNER}
import type { WorkspacePolicyValidator } from "@app-tour/workspace-sdk";

export type WorkspacePolicyValidatorBinding = {
  readonly workspaceType: string;
  readonly createValidator: () => WorkspacePolicyValidator;
};

export const WORKSPACE_POLICY_VALIDATOR_BINDINGS: readonly WorkspacePolicyValidatorBinding[] = [];

export function resolveWorkspacePolicyValidator(
  _workspaceType: string
): WorkspacePolicyValidator | undefined {
  return undefined;
}
`;
  }

  return `${BANNER}
import type { WorkspacePolicyValidator } from "@app-tour/workspace-sdk";
${[...importLines].join("\n")}

export type WorkspacePolicyValidatorBinding = {
  readonly workspaceType: string;
  readonly createValidator: () => WorkspacePolicyValidator;
};

/** Manifest-declared workspace policy validators — one factory per workspace manifest. */
export const WORKSPACE_POLICY_VALIDATOR_BINDINGS: readonly WorkspacePolicyValidatorBinding[] = [
${bindingBlocks.join("\n")}
] as const;

export function resolveWorkspacePolicyValidator(
  workspaceType: string
): WorkspacePolicyValidator | undefined {
  const binding = WORKSPACE_POLICY_VALIDATOR_BINDINGS.find(
    (entry) => entry.workspaceType === workspaceType
  );
  return binding?.createValidator();
}
`;
}
