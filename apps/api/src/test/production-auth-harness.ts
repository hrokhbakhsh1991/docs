/**
 * Test-only flag for specs that need harness-local relaxations (e.g. memory rate-limit store).
 *
 * Fail-closed:
 * - Active only when NODE_ENV=test AND APPS_API_PRODUCTION_AUTH_HARNESS=1
 * - Under NODE_ENV=production, the flag must be unset — boot throws PRODUCTION_AUTH_HARNESS_FORBIDDEN
 *
 * @see docs/phase-20/p7/appendices/BOOKING_REMEDIATION_TODO_001_HARNESS.md
 */

export const PRODUCTION_AUTH_HARNESS_FORBIDDEN = "PRODUCTION_AUTH_HARNESS_FORBIDDEN";

function harnessFlagSet(env: NodeJS.ProcessEnv): boolean {
  return env.APPS_API_PRODUCTION_AUTH_HARNESS?.trim() === "1";
}

/** True only in automated tests with the explicit harness flag. Never true in production. */
export function isProductionAuthHarnessActive(env: NodeJS.ProcessEnv = process.env): boolean {
  if (!harnessFlagSet(env)) {
    return false;
  }
  return env.NODE_ENV?.trim() === "test";
}

/**
 * Boot / auth integrity: production must not carry the test harness env var at all.
 * Call from assertAuthEnvironmentIntegrity + assertProductionRuntimeIntegrity.
 */
export function assertProductionAuthHarnessAbsent(env: NodeJS.ProcessEnv = process.env): void {
  if (env.NODE_ENV?.trim() !== "production") {
    return;
  }
  if (harnessFlagSet(env)) {
    throw new Error(PRODUCTION_AUTH_HARNESS_FORBIDDEN);
  }
}
