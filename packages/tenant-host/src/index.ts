export {
  TENANT_SUBDOMAIN_REGEX,
  TENANT_MAX_HOST_LENGTH,
  DEFAULT_TENANT_HOST_RESERVED_LABELS,
  parseReservedLabelsCsv,
} from "./constants";
export { normalizeInboundHostname, stripHostPort } from "./normalize-inbound-hostname";
export {
  parseWorkspaceTenantLabelFromHost,
  resolveWorkspaceSlugFromNormalizedHost,
  normalizeRootDomain,
  type WorkspaceTenantLabelOutcome,
} from "./parse-workspace-tenant-label";
export {
  resolveWorkspaceHost,
  type ResolveWorkspaceHostInput,
  type ResolveWorkspaceHostResult,
} from "./resolve-workspace-host";
