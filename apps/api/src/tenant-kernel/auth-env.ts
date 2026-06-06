import {
  AUTH_DEV_BEARER_FORBIDDEN_OUTSIDE_TEST,
  AUTH_JWT_REQUIRED_IN_PRODUCTION,
} from "./auth-errors";
import { isJwtVerifyConfigured } from "./jwt-env";

/**
 * Fail closed: unsigned dev bearer must never be enabled outside automated test runs.
 * Production must have RS256 JWT verify configured (DEC-023).
 */
export function assertAuthEnvironmentIntegrity(): void {
  if (process.env.AUTH_ALLOW_DEV_BEARER === "true" && process.env.NODE_ENV !== "test") {
    throw new Error(AUTH_DEV_BEARER_FORBIDDEN_OUTSIDE_TEST);
  }
  if (isProductionAuthMode() && !isJwtVerifyConfigured()) {
    throw new Error(AUTH_JWT_REQUIRED_IN_PRODUCTION);
  }
}

export function isProductionAuthMode(): boolean {
  return process.env.NODE_ENV === "production";
}

/** True only when unsigned `dev.<payload>` bearer is permitted (`NODE_ENV=test` + explicit flag). */
export function isDevBearerAllowed(): boolean {
  assertAuthEnvironmentIntegrity();
  return process.env.NODE_ENV === "test" && process.env.AUTH_ALLOW_DEV_BEARER === "true";
}
