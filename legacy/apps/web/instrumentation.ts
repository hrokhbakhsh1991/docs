/**
 * Next.js boot hook — shared deploy env validation (Phase 16.1).
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }
  const { validateWebDeployEnv } = await import("@repo/config/env-validation");
  if (process.env.SKIP_DEPLOY_ENV_VALIDATION === "true") {
    return;
  }
  validateWebDeployEnv(process.env);
}
