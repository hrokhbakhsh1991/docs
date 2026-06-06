/**
 * CI test tiers (P2-1 / P2-2).
 *
 * | Tier | Env | When |
 * |------|-----|------|
 * | trunk | `APPS_API_TEST_TIER=trunk` (default in `pnpm test`) | PR / phase-5:gate |
 * | nightly | `APPS_API_TEST_TIER=nightly` | `pnpm run test:nightly` |
 */
export type AppsApiTestTier = "trunk" | "nightly";

export function readAppsApiTestTier(env: NodeJS.ProcessEnv = process.env): AppsApiTestTier {
  const raw = env.APPS_API_TEST_TIER?.trim().toLowerCase();
  return raw === "nightly" ? "nightly" : "trunk";
}

export function isTrunkTestTier(env: NodeJS.ProcessEnv = process.env): boolean {
  return readAppsApiTestTier(env) === "trunk";
}

export function isNightlyTestTier(env: NodeJS.ProcessEnv = process.env): boolean {
  return readAppsApiTestTier(env) === "nightly";
}

/** Skip heavy probes in trunk (noise-neighbor, soak, 10k relay leak, 1000-row backlog). */
export function skipUnlessNightlyTier(label: string): boolean | string {
  if (isNightlyTestTier()) {
    return false;
  }
  return `${label} — nightly tier only (pnpm run test:nightly / APPS_API_TEST_TIER=nightly)`;
}
