import {
  AUTH_DEV_BEARER_FORBIDDEN_OUTSIDE_TEST,
  AUTH_JWT_REQUIRED_IN_PRODUCTION,
} from "./auth-errors";
import { isJwtVerifyConfigured } from "./jwt-env";
import { assertProductionAuthHarnessAbsent } from "../test/production-auth-harness";
import { isStagingInfraProfile } from "../identity/static-otp-policy";

/**
 * Fail closed: unsigned dev bearer must never be enabled outside automated test runs.
 * Production must have RS256 JWT verify configured (DEC-023).
 * Production must not set APPS_API_PRODUCTION_AUTH_HARNESS.
 */
export function assertAuthEnvironmentIntegrity(): void {
  if (process.env.AUTH_ALLOW_DEV_BEARER === "true" && process.env.NODE_ENV !== "test") {
    throw new Error(AUTH_DEV_BEARER_FORBIDDEN_OUTSIDE_TEST);
  }
  if (isProductionAuthMode()) {
    assertProductionAuthHarnessAbsent();
    if (!isJwtVerifyConfigured()) {
      throw new Error(AUTH_JWT_REQUIRED_IN_PRODUCTION);
    }
    if (process.env.OTP_FIXTURE_CODE?.trim()) {
      throw new Error("OTP_FIXTURE_CODE_FORBIDDEN_IN_PRODUCTION");
    }
    if (process.env.AUTH_ALLOW_DEV_STATIC_OTP?.trim() === "true") {
      throw new Error("AUTH_ALLOW_DEV_STATIC_OTP_FORBIDDEN_IN_PRODUCTION");
    }
    if (process.env.STAGING_ALLOW_STATIC_OTP?.trim() === "true" && !isStagingInfraProfile()) {
      throw new Error("STAGING_ALLOW_STATIC_OTP_FORBIDDEN_OUTSIDE_STAGING_PROFILE");
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
