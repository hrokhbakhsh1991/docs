const DEFAULT_DEV_BEARER = "platform-ops";

export const PLATFORM_OPS_BEARER_TOKEN_REQUIRED = "PLATFORM_OPS_BEARER_TOKEN_REQUIRED";

/**
 * Shared platform-ops bearer (PREV-AUD-004).
 * - test: may fall back to DEFAULT_DEV_BEARER when unset
 * - production / prodlike: env required (no default secret)
 */
export function readPlatformOpsBearerToken(input?: string): string {
  const fromEnv = input ?? process.env.PLATFORM_OPS_BEARER_TOKEN?.trim();
  if (fromEnv && fromEnv.length > 0) {
    return fromEnv;
  }
  if (process.env.NODE_ENV === "test") {
    return DEFAULT_DEV_BEARER;
  }
  throw new Error(PLATFORM_OPS_BEARER_TOKEN_REQUIRED);
}
