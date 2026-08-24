export {
  DEFAULT_TENANT_HOST_RESERVED_LABELS,
  parseReservedLabelsCsv,
  TENANT_MAX_HOST_LENGTH,
  TENANT_SUBDOMAIN_REGEX,
} from "./host/constants";
export {
  normalizeRootDomain,
  parseWorkspaceTenantLabelFromHost,
  resolveWorkspaceSlugFromNormalizedHost,
  type WorkspaceTenantLabelOutcome,
} from "./host/parse-workspace-tenant-label";
export {
  buildDevMarketingPublicBaseUrl,
  type BuildDevMarketingPublicBaseUrlInput,
} from "./host/build-dev-marketing-public-base-url";
export {
  buildDevPortalPublicBaseUrl,
  type BuildDevPortalPublicBaseUrlInput,
} from "./host/build-dev-portal-public-base-url";
export {
  formatCustomApexSurfaceUrl,
  tryParseCustomApexHost,
  type CustomApexSurface,
  type FormatCustomApexSurfaceUrlInput,
  type ParsedCustomApexHost,
} from "./host/parse-custom-apex-host";
export { resolveMemberSessionCookieDomain } from "./host/resolve-member-session-cookie-domain";
export {
  isLegacyClubAdminHost,
  toCanonicalClubAdminHost,
} from "./host/canonicalize-club-admin-host";
export {
  isLegacyClubPortalHost,
  toCanonicalClubPortalHost,
} from "./host/canonicalize-club-portal-host";
export {
  isClubAdminHost,
  isPlatformAdminHost,
  parseMultiLevelTenantHost,
  type MultiLevelTenantHostOutcome,
} from "./host/parse-multi-level-tenant-host";
export { RESET_RLS_TENANT_SQL, RLS_TENANT_SETTING, SET_LOCAL_RLS_TENANT_SQL } from "./rls/session";
export type { TenantRoute, TenantTier } from "./route";
export type { TenantRouteRow } from "./tenant-route-row";
export {
  resolveTenantRoute,
  TENANT_ROUTE_MISCONFIGURED,
  type ResolveTenantRouteOptions,
} from "./resolve-tenant-route";
export { TenantConnectionRouter, type TenantRouteLookup } from "./tenant-connection-router";
export {
  WORKSPACE_INFRASTRUCTURE_MISCONFIGURED,
  WORKSPACE_INFRASTRUCTURE_PLACEMENT_MODES,
  WORKSPACE_INFRASTRUCTURE_REGION_VIOLATION,
  WORKSPACE_INFRASTRUCTURE_UNKNOWN_PLACEMENT,
  RESIDENCY_POLICIES,
  type DeploymentStampCatalog,
  type InfrastructureTargetCatalog,
  type RegionId,
  type ResidencyPolicy,
  type SharedInfrastructureDefaults,
  type WorkspaceBundleDescriptor,
  type WorkspaceInfrastructurePlacement,
  type WorkspaceInfrastructurePlacementMode,
  type WorkspaceInfrastructureResolution,
  type WorkspaceInfrastructureResourceEndpoints,
} from "./workspace-infrastructure-placement";
export { computeWorkspaceBundleFingerprint } from "./workspace-bundle-fingerprint";
export {
  assertRegionAllowed,
  validateRegionalResourceMix,
  type RegionalResourceDescriptor,
} from "./workspace-residency-policy";
export {
  createWorkspaceBindingId,
  resolveWorkspaceInfrastructure,
  type ResolveWorkspaceInfrastructureInput,
} from "./resolve-workspace-infrastructure";
