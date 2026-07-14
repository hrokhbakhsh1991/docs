import { resolvePortalMemberLoginPath } from "./resolve-portal-member-login-url";
import { resolvePortalPublicBaseUrl } from "./resolve-portal-public-base-url";

/** Relative login path with portalReturn to catalog register (PCMS tour sign-in intent). */
export function resolvePortalRegistrationLoginPath(host: string, tourId: string): string | null {
  const id = tourId.trim();
  if (id.length === 0) {
    return null;
  }
  return resolvePortalMemberLoginPath(host, `/catalog/${encodeURIComponent(id)}/register`);
}

/** Cross-host tour sign-in URL — login then resume register at intake (PCMS-UX tour intent). */
export function resolvePortalRegistrationLoginUrl(host: string, tourId: string): string | null {
  const loginPath = resolvePortalRegistrationLoginPath(host, tourId);
  if (loginPath === null) {
    return null;
  }
  return `${resolvePortalPublicBaseUrl(host)}${loginPath}`;
}
