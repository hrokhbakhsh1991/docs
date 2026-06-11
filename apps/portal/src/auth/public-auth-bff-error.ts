import { bffCodedError } from "@/auth/bff-coded-error";

export const PUBLIC_CATALOG_TENANT_UNRESOLVED = "PUBLIC_CATALOG_TENANT_UNRESOLVED";

export function mapPublicAuthBffCatchError(error: unknown) {
  if (error instanceof Error && error.message === PUBLIC_CATALOG_TENANT_UNRESOLVED) {
    return bffCodedError(PUBLIC_CATALOG_TENANT_UNRESOLVED, 503);
  }
  return bffCodedError("BACKEND_UNREACHABLE", 502);
}
