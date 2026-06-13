/** Trunk-only flag for specs that simulate production auth ingress with memory storage. */
export function isProductionAuthHarnessActive(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.APPS_API_PRODUCTION_AUTH_HARNESS?.trim() === "1";
}
