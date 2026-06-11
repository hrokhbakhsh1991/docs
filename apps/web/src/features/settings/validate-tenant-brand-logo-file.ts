import {
  isTenantBrandLogoContentType,
  TENANT_BRAND_LOGO_MAX_BYTES,
} from "@app-tour/workspace-sdk";

export type TenantBrandLogoFileValidationCode =
  | "BRANDING_LOGO_TYPE_INVALID"
  | "BRANDING_LOGO_TOO_LARGE"
  | "BRANDING_LOGO_EMPTY";

export function validateTenantBrandLogoFile(
  file: File
): TenantBrandLogoFileValidationCode | null {
  if (file.size === 0) {
    return "BRANDING_LOGO_EMPTY";
  }
  if (file.size > TENANT_BRAND_LOGO_MAX_BYTES) {
    return "BRANDING_LOGO_TOO_LARGE";
  }
  if (!isTenantBrandLogoContentType(file.type)) {
    return "BRANDING_LOGO_TYPE_INVALID";
  }
  return null;
}
