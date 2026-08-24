/** MAT-010 / MAT-013 — infrastructure placement modes (business-architecture neutral). */

export const WORKSPACE_INFRASTRUCTURE_PLACEMENT_MODES = [
  "SHARED",
  "DEDICATED_DB",
  "DEDICATED_STAMP",
  "REGIONAL_STAMP",
] as const;

export type WorkspaceInfrastructurePlacementMode =
  (typeof WORKSPACE_INFRASTRUCTURE_PLACEMENT_MODES)[number];

export type RegionId = string;

export const RESIDENCY_POLICIES = [
  "HOME_REGION_ONLY",
  "APPROVED_REGIONS",
  "NO_CROSS_REGION_REPLICATION",
] as const;

export type ResidencyPolicy = (typeof RESIDENCY_POLICIES)[number];

export type WorkspaceInfrastructurePlacement = {
  readonly mode: WorkspaceInfrastructurePlacementMode;
  readonly region?: RegionId;
  readonly residencyPolicy?: ResidencyPolicy;
  readonly approvedRegions?: readonly RegionId[];
  readonly stampId?: string;
  readonly databaseTargetId?: string;
  readonly releaseSha?: string;
};

export type WorkspaceInfrastructureResourceEndpoints = {
  readonly databaseUrl: string;
  readonly cacheNamespace: string;
  readonly storageNamespace: string;
  readonly queueNamespace: string;
  readonly secretsRef: string;
  readonly monitoringIdentity: string;
};

export type WorkspaceInfrastructureResolution = {
  readonly workspaceBindingId: string;
  readonly workspaceType: string;
  readonly placement: WorkspaceInfrastructurePlacement;
  readonly stampId: string;
  readonly region: RegionId;
  readonly endpoints: WorkspaceInfrastructureResourceEndpoints;
  readonly bundleFingerprint: string;
  readonly useSharedDatabase: boolean;
};

export type WorkspaceBundleDescriptor = {
  readonly workspaceBindingId: string;
  readonly workspaceType: string;
  readonly manifestFingerprint: string;
  readonly profilePin?: { readonly id: string; readonly profileVersion: number };
  readonly capabilityPins?: Readonly<Record<string, { readonly revision: number }>>;
  readonly workspacePolicyBindingId?: string;
  readonly brandingConfigHash?: string;
  readonly placement: WorkspaceInfrastructurePlacement;
  readonly releaseSha: string;
};

export type SharedInfrastructureDefaults = {
  readonly poolDatabaseUrl: string;
  readonly cacheNamespace?: string;
  readonly storageNamespace?: string;
  readonly queueNamespace?: string;
  readonly secretsRef?: string;
  readonly monitoringIdentity?: string;
  readonly homeRegion?: RegionId;
};

export type InfrastructureTargetCatalog = Readonly<
  Record<
    string,
    {
      readonly databaseUrl?: string;
      readonly region: RegionId;
      readonly cacheNamespace?: string;
      readonly storageNamespace?: string;
      readonly queueNamespace?: string;
      readonly secretsRef?: string;
      readonly backupRegion?: RegionId;
    }
  >
>;

export type DeploymentStampCatalog = Readonly<
  Record<
    string,
    {
      readonly region: RegionId;
      readonly releaseSha: string;
      readonly databaseTargetId?: string;
      readonly cacheNamespace: string;
      readonly storageNamespace: string;
      readonly queueNamespace: string;
      readonly secretsRef: string;
      readonly monitoringIdentity: string;
      readonly backupRegion?: RegionId;
    }
  >
>;

export const WORKSPACE_INFRASTRUCTURE_UNKNOWN_PLACEMENT = "WORKSPACE_INFRASTRUCTURE_UNKNOWN_PLACEMENT";
export const WORKSPACE_INFRASTRUCTURE_MISCONFIGURED = "WORKSPACE_INFRASTRUCTURE_MISCONFIGURED";
export const WORKSPACE_INFRASTRUCTURE_REGION_VIOLATION = "WORKSPACE_INFRASTRUCTURE_REGION_VIOLATION";
