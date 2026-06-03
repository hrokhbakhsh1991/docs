import type { TenantAuthContext } from "./auth-context";
import { parseTenantAuthContext } from "./auth-schemas";
import { sdkErr, sdkOk, type SdkResult } from "../errors/sdk-result";
import {
  InvalidTenantAuthContextError,
  type AuthContextErrorCode,
} from "./auth-context-errors";

export { InvalidTenantAuthContextError, type AuthContextErrorCode } from "./auth-context-errors";

export function tryParseTenantAuthContext(
  input: unknown,
): SdkResult<TenantAuthContext, AuthContextErrorCode> {
  try {
    return sdkOk(parseTenantAuthContext(input));
  } catch (error: unknown) {
    if (error instanceof InvalidTenantAuthContextError) {
      return sdkErr(error.code, error.message);
    }
    return sdkErr("AUTH_CONTEXT_NOT_OBJECT", error instanceof Error ? error.message : String(error));
  }
}

/**
 * Fail-closed validation before building an ability.
 */
export function assertTenantAuthContext(context: TenantAuthContext): void {
  parseTenantAuthContext(context);
}
