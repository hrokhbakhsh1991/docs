/**
 * Edge-safe host helpers — no node:crypto transitive imports.
 * Use from Next.js middleware instead of the main package barrel.
 */
export {
  DEFAULT_TENANT_HOST_RESERVED_LABELS,
  parseReservedLabelsCsv,
  TENANT_MAX_HOST_LENGTH,
  TENANT_SUBDOMAIN_REGEX,
} from "./host/constants";
export {
  isLegacyClubAdminHost,
  toCanonicalClubAdminHost,
} from "./host/canonicalize-club-admin-host";
export {
  isClubAdminHost,
  isPlatformAdminHost,
  parseMultiLevelTenantHost,
  type MultiLevelTenantHostOutcome,
} from "./host/parse-multi-level-tenant-host";
export {
  normalizeRootDomain,
  parseWorkspaceTenantLabelFromHost,
  type WorkspaceTenantLabelOutcome,
} from "./host/parse-workspace-tenant-label";
export {
  tryParseCustomApexHost,
  type CustomApexSurface,
  type ParsedCustomApexHost,
} from "./host/parse-custom-apex-host";
