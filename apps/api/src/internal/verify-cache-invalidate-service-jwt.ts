import {
  assertOpsServiceJwt,
  OPS_SCOPE_CACHE_INVALIDATE,
  readAuthorizationHeader,
  UNAUTHORIZED_CACHE_INVALIDATE_SERVICE_JWT,
  UNAUTHORIZED_OPS_SERVICE_JWT,
} from "./verify-ops-service-jwt";

export const CACHE_INVALIDATE_OPS_SCOPE = OPS_SCOPE_CACHE_INVALIDATE;

export {
  readAuthorizationHeader,
  UNAUTHORIZED_CACHE_INVALIDATE_SERVICE_JWT,
  UNAUTHORIZED_OPS_SERVICE_JWT,
};

/** Production-only gate for `POST /internal/cache/invalidate` (DEC-120). */
export async function assertCacheInvalidateServiceJwt(
  authorization: string | undefined
): Promise<void> {
  await assertOpsServiceJwt(authorization, OPS_SCOPE_CACHE_INVALIDATE);
}
