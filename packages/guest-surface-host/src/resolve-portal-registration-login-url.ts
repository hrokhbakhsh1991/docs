import { resolvePortalMemberLoginPath } from "./resolve-portal-member-login-url";
import { resolvePortalPublicBaseUrl } from "./resolve-portal-public-base-url";

/**
 * Relative register path that auto-opens login modal (PCMS-UX-MODAL · DL-40).
 * Gates on member portal the same way as {@link resolvePortalMemberLoginPath}.
 */
export function resolvePortalRegistrationLoginPath(
  host: string,
  tourId: string,
  pluginIdOverride?: string | null
): string | null {
  if (resolvePortalMemberLoginPath(host, undefined, pluginIdOverride) === null) {
    return null;
  }
  const id = tourId.trim();
  if (id.length === 0) {
    return null;
  }
  return `/catalog/${encodeURIComponent(id)}/register?auth=login`;
}

/** Cross-host tour sign-in URL — register page + login modal (stay on tour context). */
export function resolvePortalRegistrationLoginUrl(
  host: string,
  tourId: string,
  pluginIdOverride?: string | null
): string | null {
  const path = resolvePortalRegistrationLoginPath(host, tourId, pluginIdOverride);
  if (path === null) {
    return null;
  }
  return `${resolvePortalPublicBaseUrl(host)}${path}`;
}
