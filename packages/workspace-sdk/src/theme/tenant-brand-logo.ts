/** Raster logo upload limits (tenant branding). */
export {
  TENANT_BRAND_LOGO_ALLOWED_CONTENT_TYPES,
  TENANT_BRAND_LOGO_MAX_BYTES,
  isTenantBrandLogoContentType,
  type TenantBrandLogoContentType,
} from "./tenant-brand-logo-types";

export type TenantBrandLogo = {
  readonly storageKey: string;
  readonly contentType?: string;
};

const UUID_SEGMENT =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Single logo object per tenant — overwrite on re-upload. */
export function buildTenantBrandLogoObjectKey(tenantId: string): string {
  const normalized = tenantId.trim().toLowerCase();
  if (!UUID_SEGMENT.test(normalized)) {
    throw new Error("TENANT_BRAND_LOGO_TENANT_ID_INVALID");
  }
  return `${normalized}/branding/logo`;
}

export function assertTenantBrandLogoKeyTenantScope(key: string, tenantId: string): void {
  const expected = buildTenantBrandLogoObjectKey(tenantId);
  if (key.trim() !== expected) {
    throw new Error("TENANT_BRAND_LOGO_KEY_FORBIDDEN");
  }
}

export { assertTenantBrandLogoBytesMatchContentType, sniffTenantBrandLogoContentType } from "./tenant-brand-logo-bytes";

export function isTenantBrandLogoStorageKey(key: string): boolean {
  const trimmed = key.trim();
  const slash = trimmed.indexOf("/");
  if (slash <= 0) {
    return false;
  }
  const tenantSegment = trimmed.slice(0, slash);
  return UUID_SEGMENT.test(tenantSegment) && trimmed.endsWith("/branding/logo");
}
