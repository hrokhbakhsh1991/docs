import type { TenantBrandLogoContentType } from "./tenant-brand-logo-types";
import { isTenantBrandLogoContentType } from "./tenant-brand-logo-types";

/** Sniff raster format from magic bytes (upload hardening). */
export function sniffTenantBrandLogoContentType(body: Buffer): TenantBrandLogoContentType | null {
  if (body.length < 12) {
    return null;
  }
  if (body[0] === 0x89 && body[1] === 0x50 && body[2] === 0x4e && body[3] === 0x47) {
    return "image/png";
  }
  if (body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    body.toString("ascii", 0, 4) === "RIFF" &&
    body.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

export function assertTenantBrandLogoBytesMatchContentType(
  body: Buffer,
  contentType: string
): void {
  const normalized = contentType.trim().toLowerCase();
  if (!isTenantBrandLogoContentType(normalized)) {
    throw new Error("TENANT_BRAND_LOGO_CONTENT_TYPE_INVALID");
  }
  const sniffed = sniffTenantBrandLogoContentType(body);
  if (sniffed === null) {
    throw new Error("TENANT_BRAND_LOGO_BYTES_UNRECOGNIZED");
  }
  if (sniffed !== normalized) {
    throw new Error("TENANT_BRAND_LOGO_BYTES_CONTENT_TYPE_MISMATCH");
  }
}
