/**
 * Explicit runtime profile for staging / prodlike boots (TODO-003 / MR-P1-005).
 * When `APP_RUNTIME_PROFILE=prodlike`, production-grade integrity probes run
 * even if NODE_ENV is not `production`.
 */
export function isProdlikeRuntimeProfile(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.APP_RUNTIME_PROFILE?.trim().toLowerCase() === "prodlike";
}

export function requiresProductionGradeIntegrity(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV?.trim() === "production" || isProdlikeRuntimeProfile(env);
}
