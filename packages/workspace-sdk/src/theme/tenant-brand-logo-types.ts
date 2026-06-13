/** Raster logo upload limits (tenant branding). */
export const TENANT_BRAND_LOGO_MAX_BYTES = 2 * 1024 * 1024;

export const TENANT_BRAND_LOGO_ALLOWED_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type TenantBrandLogoContentType =
  (typeof TENANT_BRAND_LOGO_ALLOWED_CONTENT_TYPES)[number];

export function isTenantBrandLogoContentType(
  value: string
): value is TenantBrandLogoContentType {
  return (TENANT_BRAND_LOGO_ALLOWED_CONTENT_TYPES as readonly string[]).includes(
    value.trim().toLowerCase()
  );
}
