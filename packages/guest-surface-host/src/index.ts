export { PHASE_43_HOST_TENANT_IDS, resolveTenantIdFromIngressLabel } from "./phase-43-host-tenant-ids";
export {
  CANONICAL_SMOKE_OPERATOR_MARKETING_BASE_URL,
  CANONICAL_SMOKE_OPERATOR_PORTAL_BASE_URL,
  CANONICAL_SMOKE_URBAN_MARKETING_BASE_URL,
} from "./canonical-smoke-urls";
export { isDevGuestHostAllowed, isDevWebSessionAllowed } from "./is-dev-guest-host-allowed";
export { resolvePublicBrandingHost } from "./resolve-public-branding-host";
export {
  resolveTenantIdFromDevHost,
  type GuestDevHostSurface,
} from "./resolve-tenant-id-from-dev-host";
export {
  fetchPublicTenantContextForHost,
  type PublicTenantContextSnapshot,
  type FetchPublicTenantContextOptions,
} from "./fetch-public-tenant-context";
export {
  fetchPublicTenantBrandingForHost,
  type PublicTenantBrandingSnapshot,
  type FetchPublicTenantBrandingOptions,
} from "./fetch-public-tenant-branding";
export {
  PUBLIC_TENANT_BRAND_LOGO_SIGNED_URL_TTL_SECONDS,
  resolveGuestBootstrapRevalidateSeconds,
  resolveGuestBrandingRevalidateSeconds,
} from "./resolve-guest-fetch-revalidate";
export {
  resolveAdminBootstrapForHost,
  type AdminSurfaceBootstrap,
  type AdminSurfaceUnresolvedError,
  type ResolveAdminSurfaceBootstrapOptions,
} from "./resolve-admin-surface-bootstrap";
export {
  resolveGuestSurfaceBootstrapForHost,
  type GuestSurfaceBootstrap,
  type GuestSurfaceUnresolvedError,
  type ResolveGuestSurfaceBootstrapOptions,
} from "./resolve-guest-surface-bootstrap";
export {
  OPERATOR_SMOKE_TENANT_ID,
  resolveDevPluginIdForTenantId,
} from "./resolve-dev-plugin-id";
export {
  resolveMarketingPublicBaseUrl,
  resolveMarketingTourDetailUrl,
  resolveMarketingToursUrl,
} from "./resolve-marketing-public-base-url";
export {
  resolvePortalPublicBaseUrl,
  resolvePortalRegistrationUrl,
} from "./resolve-portal-public-base-url";
export {
  resolvePortalMemberModuleUrl,
} from "./resolve-portal-member-module-url";
export { resolvePluginIdFromIngressHost } from "./resolve-plugin-id-from-ingress-host";
export {
  isEmbeddedMemberPortalHost,
  resolveEmbeddedMemberPortalHost,
  type EmbeddedMemberPortalHost,
} from "./embedded/resolve-embedded-member-portal-host";
export {
  assertGuestBffProductionConfig,
  resolveTourOpsApiBaseUrl,
} from "./resolve-tour-ops-api-base-url";
