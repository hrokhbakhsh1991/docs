/** Phase 8.4 urban smoke hosts — sync `tenant-kernel.server.ts` DEV_HOST_SESSION_PROFILES. */
const DEV_E2E_MIDDLEWARE_BYPASS_HOSTS = new Set(["urban-owner", "urban-member"]);

/**
 * Dev-only: allow Playwright urban smoke to reach page-level CASL guards without owner cookie.
 * Edge middleware may not receive `ALLOW_DEV_WEB_SESSION`; `*.localhost` labels are dev-only.
 */
export function shouldBypassMiddlewareForDevE2eHost(host: string): boolean {
  if (process.env.NODE_ENV === "production") {
    return false;
  }

  const hostname = host.split(":")[0]?.trim().toLowerCase() ?? "";
  const match = /^([a-z0-9-]+)\.localhost$/.exec(hostname);
  if (!match?.[1]) {
    return false;
  }

  return DEV_E2E_MIDDLEWARE_BYPASS_HOSTS.has(match[1]);
}
