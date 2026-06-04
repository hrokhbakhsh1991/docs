import { AUTH_DEV_BEARER_FORBIDDEN_OUTSIDE_TEST } from "./auth-errors";

/**
 * Fail closed: unsigned dev bearer must never be enabled outside automated test runs.
 */
export function assertAuthEnvironmentIntegrity(): void {
  if (process.env.AUTH_ALLOW_DEV_BEARER === "true" && process.env.NODE_ENV !== "test") {
    throw new Error(AUTH_DEV_BEARER_FORBIDDEN_OUTSIDE_TEST);
  }
}

/** True only when unsigned `dev.<payload>` bearer is permitted (`NODE_ENV=test` + explicit flag). */
export function isDevBearerAllowed(): boolean {
  assertAuthEnvironmentIntegrity();
  return process.env.NODE_ENV === "test" && process.env.AUTH_ALLOW_DEV_BEARER === "true";
}
