/** Phase 8.4 product smoke hosts — sync `dev-host-session-profiles.ts` DEV_HOST_SESSION_PROFILES. */
const DEV_E2E_MIDDLEWARE_BYPASS_HOSTS = new Set([
  "workspace-owner-smoke",
  "workspace-member-smoke",
]);

/**
 * Smoke label on apex `{label}.localhost`, WRS canonical `admin.{label}.localhost`,
 * or legacy `{label}.admin.localhost`. `admin.localhost` itself is not a smoke host.
 */
export function readDevE2eSmokeHostLabel(host: string): string | null {
  const hostname = host.split(":")[0]?.trim().toLowerCase() ?? "";
  const inverted = /^admin\.([a-z0-9-]+)\.localhost$/.exec(hostname);
  if (inverted?.[1]) {
    return inverted[1];
  }
  const legacyAdmin = /^([a-z0-9-]+)\.admin\.localhost$/.exec(hostname);
  if (legacyAdmin?.[1]) {
    return legacyAdmin[1];
  }
  const apex = /^([a-z0-9-]+)\.localhost$/.exec(hostname);
  if (apex?.[1] && apex[1] !== "admin") {
    return apex[1];
  }
  return null;
}

/**
 * Dev-only: allow Playwright product smoke to reach page-level CASL guards without owner cookie.
 * Edge middleware may not receive `ALLOW_DEV_WEB_SESSION`; `*.localhost` labels are dev-only.
 */
export function shouldBypassMiddlewareForDevE2eHost(host: string): boolean {
  if (process.env.NODE_ENV === "production") {
    return false;
  }

  const label = readDevE2eSmokeHostLabel(host);
  if (label === null) {
    return false;
  }

  return DEV_E2E_MIDDLEWARE_BYPASS_HOSTS.has(label);
}
