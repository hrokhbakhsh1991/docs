import { supportsCatalogRegistration } from "@app-tour/workspace-sdk";

import {
  resolvePortalPublicBaseUrl,
  resolvePortalRegistrationLoginUrl,
  resolvePortalRegistrationUrl,
  resolvePortalMemberModuleUrl,
} from "@app-tour/guest-surface-host";

export { supportsCatalogRegistration };

export {
  resolvePortalPublicBaseUrl,
  resolvePortalRegistrationLoginUrl,
  resolvePortalRegistrationUrl,
  resolvePortalMemberModuleUrl,
};

/** @deprecated Use `resolvePortalPublicBaseUrl` — kept for transitional imports. */
export const resolveWebPublicBaseUrl = resolvePortalPublicBaseUrl;

/** Public registration on apps/portal — null when workspace has no public intake. */
export function resolveWebRegistrationUrl(
  host: string,
  tourId: string,
  pluginId: string
): string | null {
  if (!supportsCatalogRegistration(pluginId)) {
    return null;
  }
  const id = tourId.trim();
  if (id.length === 0) {
    return null;
  }
  return resolvePortalRegistrationUrl(host, id);
}

/** Tour PDP sign-in — register page with auth=login modal (PCMS-UX-MODAL). */
export function resolveWebRegistrationLoginUrl(
  host: string,
  tourId: string,
  pluginId: string
): string | null {
  if (!supportsCatalogRegistration(pluginId)) {
    return null;
  }
  const id = tourId.trim();
  if (id.length === 0) {
    return null;
  }
  return resolvePortalRegistrationLoginUrl(host, id);
}

/**
 * Portal member registration detail — `{moduleUrl}/{id}`.
 * Fail-closed on empty / path-like ids (no open redirect).
 */
export function resolveWebMemberRegistrationDetailUrl(
  host: string,
  registrationId: string
): string | null {
  const moduleUrl = resolvePortalMemberModuleUrl(host);
  if (moduleUrl === null) {
    return null;
  }
  const id = registrationId.trim();
  if (id.length === 0 || id.includes("/") || id.includes("\\") || id.includes("..")) {
    return null;
  }
  return `${moduleUrl.replace(/\/$/, "")}/${encodeURIComponent(id)}`;
}
