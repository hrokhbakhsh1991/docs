import { BANNER } from "../constants.mjs";

import { resolveWorkspaceEquipmentManifest } from "./equipment.mjs";

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
    (id) => `  // ${id} — validator port deferred to CW8-04/CW7-03`
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
