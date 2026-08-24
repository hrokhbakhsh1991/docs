import type {
  RegionId,
  ResidencyPolicy,
  WorkspaceInfrastructurePlacement,
} from "./workspace-infrastructure-placement";
import { WORKSPACE_INFRASTRUCTURE_REGION_VIOLATION } from "./workspace-infrastructure-placement";

export type RegionalResourceDescriptor = {
  readonly kind: "database" | "cache" | "storage" | "queue" | "secrets" | "backup";
  readonly region: RegionId;
  readonly resourceId: string;
};

export function assertRegionAllowed(
  homeRegion: RegionId,
  resourceRegion: RegionId,
  policy: ResidencyPolicy | undefined,
  approvedRegions: readonly RegionId[] | undefined
): void {
  const normalizedHome = homeRegion.trim();
  const normalizedResource = resourceRegion.trim();
  if (normalizedHome.length === 0 || normalizedResource.length === 0) {
    throw new Error(WORKSPACE_INFRASTRUCTURE_REGION_VIOLATION);
  }

  if (policy === undefined || policy === "HOME_REGION_ONLY") {
    if (normalizedResource !== normalizedHome) {
      throw new Error(WORKSPACE_INFRASTRUCTURE_REGION_VIOLATION);
    }
    return;
  }

  if (policy === "APPROVED_REGIONS") {
    const allowed = new Set([normalizedHome, ...(approvedRegions ?? []).map((row) => row.trim())]);
    if (!allowed.has(normalizedResource)) {
      throw new Error(WORKSPACE_INFRASTRUCTURE_REGION_VIOLATION);
    }
    return;
  }

  if (policy === "NO_CROSS_REGION_REPLICATION") {
    if (normalizedResource !== normalizedHome) {
      throw new Error(WORKSPACE_INFRASTRUCTURE_REGION_VIOLATION);
    }
  }
}

export function validateRegionalResourceMix(input: {
  readonly placement: WorkspaceInfrastructurePlacement;
  readonly homeRegion: RegionId;
  readonly resources: readonly RegionalResourceDescriptor[];
}): readonly string[] {
  const violations: string[] = [];
  const policy = input.placement.residencyPolicy;
  const approved = input.placement.approvedRegions;

  for (const resource of input.resources) {
    try {
      assertRegionAllowed(input.homeRegion, resource.region, policy, approved);
    } catch {
      violations.push(`${resource.kind}:${resource.resourceId}:region-mismatch`);
    }
  }

  const backup = input.resources.find((row) => row.kind === "backup");
  if (
    policy === "NO_CROSS_REGION_REPLICATION" &&
    backup != null &&
    backup.region.trim() !== input.homeRegion.trim()
  ) {
    violations.push("backup:cross-region-replication-forbidden");
  }

  return violations;
}
