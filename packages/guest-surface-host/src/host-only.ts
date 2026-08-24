/**
 * Edge-safe guest host helpers — no tenant-kernel barrel (node:crypto) transitive imports.
 * Use from Next.js middleware instead of the main package barrel.
 */
export { resolvePublicBrandingHost } from "./resolve-public-branding-host";
export {
  resolveTenantIdFromDevHost,
  type GuestDevHostSurface,
} from "./resolve-tenant-id-from-dev-host";
export { resolveTenantIdFromIngressLabel } from "./phase-43-host-tenant-ids";
export {
  OPERATOR_SMOKE_TENANT_ID,
  resolveDevPluginIdForTenantId,
} from "./resolve-dev-plugin-id";
