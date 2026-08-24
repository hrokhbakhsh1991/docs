import { computeWorkspaceBundleFingerprint } from "./workspace-bundle-fingerprint";
import { assertRegionAllowed } from "./workspace-residency-policy";
import type {
  DeploymentStampCatalog,
  InfrastructureTargetCatalog,
  RegionId,
  SharedInfrastructureDefaults,
  WorkspaceBundleDescriptor,
  WorkspaceInfrastructurePlacement,
  WorkspaceInfrastructurePlacementMode,
  WorkspaceInfrastructureResolution,
} from "./workspace-infrastructure-placement";
import {
  WORKSPACE_INFRASTRUCTURE_MISCONFIGURED,
  WORKSPACE_INFRASTRUCTURE_UNKNOWN_PLACEMENT,
} from "./workspace-infrastructure-placement";

export type ResolveWorkspaceInfrastructureInput = {
  readonly workspaceBindingId: string;
  readonly workspaceType: string;
  readonly placement: WorkspaceInfrastructurePlacement;
  readonly bundle: Omit<WorkspaceBundleDescriptor, "placement" | "workspaceBindingId" | "workspaceType">;
  readonly sharedDefaults: SharedInfrastructureDefaults;
  readonly databaseTargets?: InfrastructureTargetCatalog;
  readonly deploymentStamps?: DeploymentStampCatalog;
};

function assertNonEmpty(value: string | undefined, code: string): string {
  const normalized = value?.trim() ?? "";
  if (normalized.length === 0) {
    throw new Error(code);
  }
  return normalized;
}

function resolveRegion(
  placement: WorkspaceInfrastructurePlacement,
  fallback: RegionId | undefined
): RegionId {
  const region = placement.region?.trim() || fallback?.trim() || "";
  if (region.length === 0) {
    throw new Error(WORKSPACE_INFRASTRUCTURE_MISCONFIGURED);
  }
  return region;
}

function buildSharedEndpoints(
  sharedDefaults: SharedInfrastructureDefaults,
  workspaceBindingId: string
): WorkspaceInfrastructureResolution["endpoints"] {
  return {
    databaseUrl: sharedDefaults.poolDatabaseUrl,
    cacheNamespace: sharedDefaults.cacheNamespace ?? `shared:${workspaceBindingId}`,
    storageNamespace: sharedDefaults.storageNamespace ?? `shared:${workspaceBindingId}`,
    queueNamespace: sharedDefaults.queueNamespace ?? `shared:${workspaceBindingId}`,
    secretsRef: sharedDefaults.secretsRef ?? "shared/platform",
    monitoringIdentity: sharedDefaults.monitoringIdentity ?? "shared-stamp",
  };
}

function resolveDedicatedDatabase(
  placement: WorkspaceInfrastructurePlacement,
  databaseTargets: InfrastructureTargetCatalog | undefined,
  homeRegion: RegionId
): { readonly databaseUrl: string; readonly region: RegionId } {
  const targetId = assertNonEmpty(
    placement.databaseTargetId,
    WORKSPACE_INFRASTRUCTURE_MISCONFIGURED
  );
  const target = databaseTargets?.[targetId];
  if (target === undefined) {
    throw new Error(WORKSPACE_INFRASTRUCTURE_MISCONFIGURED);
  }
  const databaseUrl = target.databaseUrl?.trim();
  if (databaseUrl === undefined || databaseUrl.length === 0) {
    throw new Error(WORKSPACE_INFRASTRUCTURE_MISCONFIGURED);
  }
  const region = target.region?.trim() || homeRegion;
  assertRegionAllowed(homeRegion, region, placement.residencyPolicy, placement.approvedRegions);
  return { databaseUrl, region };
}

function resolveStampPlacement(
  placement: WorkspaceInfrastructurePlacement,
  mode: Extract<WorkspaceInfrastructurePlacementMode, "DEDICATED_STAMP" | "REGIONAL_STAMP">,
  sharedDefaults: SharedInfrastructureDefaults,
  deploymentStamps: DeploymentStampCatalog | undefined,
  databaseTargets: InfrastructureTargetCatalog | undefined
): {
  readonly stampId: string;
  readonly region: RegionId;
  readonly endpoints: WorkspaceInfrastructureResolution["endpoints"];
  readonly useSharedDatabase: boolean;
} {
  const stampId = assertNonEmpty(placement.stampId, WORKSPACE_INFRASTRUCTURE_MISCONFIGURED);
  const stamp = deploymentStamps?.[stampId];
  if (stamp === undefined) {
    throw new Error(WORKSPACE_INFRASTRUCTURE_MISCONFIGURED);
  }

  const homeRegion = resolveRegion(placement, stamp.region);
  assertRegionAllowed(homeRegion, stamp.region, placement.residencyPolicy, placement.approvedRegions);

  if (mode === "REGIONAL_STAMP" && placement.region?.trim() !== stamp.region.trim()) {
    throw new Error(WORKSPACE_INFRASTRUCTURE_MISCONFIGURED);
  }

  let databaseUrl = sharedDefaults.poolDatabaseUrl;
  let useSharedDatabase = true;
  if (stamp.databaseTargetId != null) {
    const dedicated = resolveDedicatedDatabase(
      { ...placement, databaseTargetId: stamp.databaseTargetId },
      databaseTargets,
      homeRegion
    );
    databaseUrl = dedicated.databaseUrl;
    useSharedDatabase = false;
  }

  if (stamp.backupRegion != null) {
    assertRegionAllowed(
      homeRegion,
      stamp.backupRegion,
      placement.residencyPolicy,
      placement.approvedRegions
    );
  }

  return {
    stampId,
    region: homeRegion,
    useSharedDatabase,
    endpoints: {
      databaseUrl,
      cacheNamespace: stamp.cacheNamespace,
      storageNamespace: stamp.storageNamespace,
      queueNamespace: stamp.queueNamespace,
      secretsRef: stamp.secretsRef,
      monitoringIdentity: stamp.monitoringIdentity,
    },
  };
}

/**
 * Neutral infrastructure resolver (MAT-010 / MAT-013).
 * Domain code must consume resolved context — not call this directly from Tour Core.
 */
export function resolveWorkspaceInfrastructure(
  input: ResolveWorkspaceInfrastructureInput
): WorkspaceInfrastructureResolution {
  const workspaceBindingId = assertNonEmpty(
    input.workspaceBindingId,
    WORKSPACE_INFRASTRUCTURE_MISCONFIGURED
  );
  const workspaceType = assertNonEmpty(input.workspaceType, WORKSPACE_INFRASTRUCTURE_MISCONFIGURED);
  const placement = input.placement;
  const homeRegion = resolveRegion(placement, input.sharedDefaults.homeRegion);

  const bundle: WorkspaceBundleDescriptor = {
    workspaceBindingId,
    workspaceType,
    placement,
    ...input.bundle,
  };
  const bundleFingerprint = computeWorkspaceBundleFingerprint(bundle);

  switch (placement.mode) {
    case "SHARED": {
      const endpoints = buildSharedEndpoints(input.sharedDefaults, workspaceBindingId);
      return {
        workspaceBindingId,
        workspaceType,
        placement,
        stampId: "shared",
        region: homeRegion,
        endpoints,
        bundleFingerprint,
        useSharedDatabase: true,
      };
    }
    case "DEDICATED_DB": {
      const dedicated = resolveDedicatedDatabase(
        placement,
        input.databaseTargets,
        homeRegion
      );
      const sharedEndpoints = buildSharedEndpoints(input.sharedDefaults, workspaceBindingId);
      return {
        workspaceBindingId,
        workspaceType,
        placement,
        stampId: `db:${placement.databaseTargetId}`,
        region: dedicated.region,
        endpoints: {
          ...sharedEndpoints,
          databaseUrl: dedicated.databaseUrl,
        },
        bundleFingerprint,
        useSharedDatabase: false,
      };
    }
    case "DEDICATED_STAMP":
    case "REGIONAL_STAMP": {
      const stamp = resolveStampPlacement(
        placement,
        placement.mode,
        input.sharedDefaults,
        input.deploymentStamps,
        input.databaseTargets
      );
      return {
        workspaceBindingId,
        workspaceType,
        placement,
        stampId: stamp.stampId,
        region: stamp.region,
        endpoints: stamp.endpoints,
        bundleFingerprint,
        useSharedDatabase: stamp.useSharedDatabase,
      };
    }
    default:
      throw new Error(WORKSPACE_INFRASTRUCTURE_UNKNOWN_PLACEMENT);
  }
}

export function createWorkspaceBindingId(tenantId: string, workspaceType: string): string {
  const normalizedTenant = tenantId.trim();
  const normalizedWorkspace = workspaceType.trim().toLowerCase();
  if (normalizedTenant.length === 0 || normalizedWorkspace.length === 0) {
    throw new Error(WORKSPACE_INFRASTRUCTURE_MISCONFIGURED);
  }
  return `${normalizedTenant}:${normalizedWorkspace}`;
}
