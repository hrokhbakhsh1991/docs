/** Dev e2e host labels — keep in sync with tenant-kernel.server DEV_HOST_SESSION_PROFILES. */
const DEV_HOST_SESSION_PROFILE_KEYS = new Set([
  "deny-theme",
  "urban-owner",
  "urban-member",
]);

/** Caller must gate with isDevWebSessionAllowed() (Edge middleware env inlining). */
export function hasDevHostSmokeSessionProfile(host: string): boolean {
  const hostname = host.split(":")[0]?.trim().toLowerCase() ?? "";
  const match = /^([a-z0-9-]+)\.localhost$/.exec(hostname);
  if (!match?.[1]) {
    return false;
  }
  return DEV_HOST_SESSION_PROFILE_KEYS.has(match[1]);
}
