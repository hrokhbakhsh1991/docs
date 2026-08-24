/** Edge-safe host parsing surface — no Node-only workspace infrastructure deps. */
export {
  DEFAULT_TENANT_HOST_RESERVED_LABELS,
  parseReservedLabelsCsv,
  TENANT_MAX_HOST_LENGTH,
  TENANT_SUBDOMAIN_REGEX,
} from "./constants";
export {
  normalizeRootDomain,
  parseWorkspaceTenantLabelFromHost,
  resolveWorkspaceSlugFromNormalizedHost,
  type WorkspaceTenantLabelOutcome,
} from "./parse-workspace-tenant-label";
export {
  buildDevMarketingPublicBaseUrl,
  type BuildDevMarketingPublicBaseUrlInput,
} from "./build-dev-marketing-public-base-url";
export {
  buildDevPortalPublicBaseUrl,
  type BuildDevPortalPublicBaseUrlInput,
} from "./build-dev-portal-public-base-url";
export {
  formatCustomApexSurfaceUrl,
  tryParseCustomApexHost,
  type CustomApexSurface,
  type FormatCustomApexSurfaceUrlInput,
  type ParsedCustomApexHost,
} from "./parse-custom-apex-host";
export { resolveMemberSessionCookieDomain } from "./resolve-member-session-cookie-domain";
export {
  isLegacyClubAdminHost,
  toCanonicalClubAdminHost,
} from "./canonicalize-club-admin-host";
export {
  isLegacyClubPortalHost,
  toCanonicalClubPortalHost,
} from "./canonicalize-club-portal-host";
export {
  isClubAdminHost,
  isPlatformAdminHost,
  parseMultiLevelTenantHost,
  type MultiLevelTenantHostOutcome,
} from "./parse-multi-level-tenant-host";
