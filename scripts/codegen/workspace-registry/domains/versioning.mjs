#!/usr/bin/env node
/**
 * MAT-001 — codegen domain for capability/profile revision registries.
 */
import { BANNER } from "../constants.mjs";
import { loadProfileCatalog } from "./profile-expansion.mjs";

const CAPABILITY_BLOCK_KEYS = [
  "workspaceEquipment",
  "workspaceTransport",
  "workspaceDifficultyFitness",
  "workspaceItinerary",
  "workspacePricing",
  "workspaceBooking",
  "workspaceFinance",
  "workspaceWallet",
  "workspaceTicketing",
];

/**
 * @param {unknown} block
 * @returns {number}
 */
function readCapabilityRevision(block) {
  if (block === undefined || typeof block !== "object" || block === null) {
    return 1;
  }
  const raw = /** @type {Record<string, unknown>} */ (block).capabilityRevision;
  if (typeof raw === "number" && Number.isInteger(raw) && raw >= 1) {
    return raw;
  }
  return 1;
}

/**
 * @param {readonly Record<string, unknown>[]} manifests
 */
export function generateWorkspaceCapabilityRevisionRegistry(manifests) {
  /** @type {Record<string, Record<string, number>>} */
  const byWorkspace = {};

  for (const manifest of manifests) {
    const workspaceType = manifest.workspaceTypes?.[0];
    if (typeof workspaceType !== "string" || workspaceType.trim().length === 0) {
      continue;
    }
    /** @type {Record<string, number>} */
    const caps = {};
    for (const key of CAPABILITY_BLOCK_KEYS) {
      const block = manifest[key];
      if (block === undefined) {
        continue;
      }
      if (typeof block === "object" && block !== null && block.supported === false) {
        continue;
      }
      caps[key] = readCapabilityRevision(block);
    }
    if (Object.keys(caps).length > 0) {
      byWorkspace[workspaceType] = caps;
    }
  }

  const workspaceEntries = Object.keys(byWorkspace)
    .sort()
    .map((workspaceType) => {
      const caps = byWorkspace[workspaceType];
      const capLines = Object.keys(caps)
        .sort()
        .map((capId) => `    ${JSON.stringify(capId)}: ${caps[capId]},`)
        .join("\n");
      return `  ${JSON.stringify(workspaceType)}: Object.freeze({
${capLines}
  }),`;
    })
    .join("\n");

  return `${BANNER}
export type WorkspaceCapabilityRevisionRegistry = Readonly<
  Record<string, Readonly<Record<string, number>>>
>;

/** Manifest-declared capability revisions — default 1 when omitted (MAT-001). */
export const WORKSPACE_CAPABILITY_REVISION_REGISTRY: WorkspaceCapabilityRevisionRegistry = Object.freeze({
${workspaceEntries}
});

export function listWorkspaceCapabilityRevisions(
  workspaceType: string
): Readonly<Record<string, number>> | null {
  return WORKSPACE_CAPABILITY_REVISION_REGISTRY[workspaceType] ?? null;
}

export function resolveRegisteredCapabilityRevision(
  workspaceType: string,
  capabilityId: string
): number | null {
  const row = listWorkspaceCapabilityRevisions(workspaceType);
  if (row === null) {
    return null;
  }
  return row[capabilityId] ?? null;
}
`;
}

/**
 * @param {readonly Record<string, unknown>[]} _manifests
 */
export function generateWorkspaceProfileVersionRegistry(_manifests) {
  const catalog = loadProfileCatalog();
  const profileEntries = [...catalog.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([profileId, profile]) => {
      const version =
        typeof profile.version === "number" && Number.isInteger(profile.version) && profile.version >= 1
          ? profile.version
          : 1;
      return `  ${JSON.stringify(profileId)}: Object.freeze([${version}]),`;
    })
    .join("\n");

  return `${BANNER}
export type WorkspaceProfileVersionRegistry = Readonly<Record<string, readonly number[]>>;

/** Profile catalog versions — monotonic integers per profile id (MAT-001). */
export const WORKSPACE_PROFILE_VERSION_REGISTRY: WorkspaceProfileVersionRegistry = Object.freeze({
${profileEntries}
});

export function listSupportedProfileVersions(profileId: string): readonly number[] | null {
  return WORKSPACE_PROFILE_VERSION_REGISTRY[profileId] ?? null;
}
`;
}

/**
 * @param {readonly Record<string, unknown>[]} manifests
 */
export function generateWorkspaceVersioningCatalog(manifests) {
  const catalog = loadProfileCatalog();
  /** @type {Record<string, Record<string, readonly number[]>>} */
  const capabilityCatalog = {};
  for (const manifest of manifests) {
    const workspaceType = manifest.workspaceTypes?.[0];
    if (typeof workspaceType !== "string") {
      continue;
    }
    /** @type {Record<string, number[]>} */
    const caps = {};
    for (const key of CAPABILITY_BLOCK_KEYS) {
      const block = manifest[key];
      if (block === undefined) {
        continue;
      }
      if (typeof block === "object" && block !== null && block.supported === false) {
        continue;
      }
      const revision = readCapabilityRevision(block);
      caps[key] = [revision];
    }
    if (Object.keys(caps).length > 0) {
      capabilityCatalog[workspaceType] = caps;
    }
  }

  const profileCatalogEntries = [...catalog.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, profile]) => {
      const version =
        typeof profile.version === "number" && Number.isInteger(profile.version) && profile.version >= 1
          ? profile.version
          : 1;
      return `    ${JSON.stringify(id)}: Object.freeze([${version}]),`;
    })
    .join("\n");

  const capabilityEntries = Object.keys(capabilityCatalog)
    .sort()
    .map((workspaceType) => {
      const caps = capabilityCatalog[workspaceType];
      const capLines = Object.keys(caps)
        .sort()
        .map((capId) => {
          const revisions = caps[capId];
          return `      ${JSON.stringify(capId)}: Object.freeze([${revisions.join(", ")}]),`;
        })
        .join("\n");
      return `    ${JSON.stringify(workspaceType)}: Object.freeze({
${capLines}
    }),`;
    })
    .join("\n");

  return `${BANNER}
import type { WorkspaceUpgradePreflightInput } from "../manifest/workspace-versioning";
import { runWorkspaceUpgradePreflight } from "../manifest/workspace-versioning";

export const WORKSPACE_PROFILE_VERSION_CATALOG = Object.freeze({
${profileCatalogEntries}
});

export const WORKSPACE_CAPABILITY_VERSION_CATALOG = Object.freeze({
${capabilityEntries}
});

export function createWorkspaceUpgradePreflightInput(
  workspaceType: string,
  currentPins: WorkspaceUpgradePreflightInput["currentPins"],
  targetPins: WorkspaceUpgradePreflightInput["targetPins"]
): WorkspaceUpgradePreflightInput {
  return {
    workspaceType,
    currentPins,
    targetPins,
    profileCatalog: WORKSPACE_PROFILE_VERSION_CATALOG,
    capabilityCatalog: WORKSPACE_CAPABILITY_VERSION_CATALOG,
  };
}

export { runWorkspaceUpgradePreflight };
`;
}
