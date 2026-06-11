import { bffCodedError } from "@/auth/bff-coded-error";

export const OPERATOR_BFF_TENANT_UNRESOLVED = "OPERATOR_BFF_TENANT_UNRESOLVED";

export function mapOperatorAuthBffCatchError(error: unknown) {
  if (error instanceof Error && error.message === OPERATOR_BFF_TENANT_UNRESOLVED) {
    return bffCodedError(OPERATOR_BFF_TENANT_UNRESOLVED, 503);
  }
  return bffCodedError("BACKEND_UNREACHABLE", 502);
}
