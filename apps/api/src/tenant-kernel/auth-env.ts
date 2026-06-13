import {
  AUTH_DEV_BEARER_FORBIDDEN_OUTSIDE_TEST,
  AUTH_JWT_REQUIRED_IN_PRODUCTION,
} from "./auth-errors";
import { isJwtVerifyConfigured } from "./jwt-env";
import { isProductionAuthHarnessActive } from "../test/production-auth-harness";

/**
 * Fail closed: unsigned dev bearer must never be enabled outside automated test runs.
 * Production must have RS256 JWT verify configured (DEC-023).
 */
export function assertAuthEnvironmentIntegrity(): void {
  if (process.env.AUTH_ALLOW_DEV_BEARER === "true" && process.env.NODE_ENV !== "test") {
    throw new Error(AUTH_DEV_BEARER_FORBIDDEN_OUTSIDE_TEST);
  }
  if (isProductionAuthMode()) {
    if (!isJwtVerifyConfigured()) {
      throw new Error(AUTH_JWT_REQUIRED_IN_PRODUCTION);
    }
    if (isProductionAuthHarnessActive()) {
      return;
    }
    if (process.env.OTP_FIXTURE_CODE?.trim()) {
      throw new Error("OTP_FIXTURE_CODE_FORBIDDEN_IN_PRODUCTION");
    }
    if (process.env.AUTH_ALLOW_DEV_STATIC_OTP?.trim() === "true") {
      throw new Error("AUTH_ALLOW_DEV_STATIC_OTP_FORBIDDEN_IN_PRODUCTION");
    }
  }
}

export function isProductionAuthMode(): boolean {
  return process.env.NODE_ENV === "production";
}

/** True only when unsigned `dev.<payload>` bearer is permitted (`NODE_ENV=test` + explicit flag). */
export function isDevBearerPermitted(): boolean {
  return process.env.NODE_ENV === "test" && process.env.AUTH_ALLOW_DEV_BEARER === "true";
}

export function isDevBearerAllowed(): boolean {
  assertAuthEnvironmentIntegrity();
  return isDevBearerPermitted();
}
