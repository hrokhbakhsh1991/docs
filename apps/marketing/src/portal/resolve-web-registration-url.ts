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

export function resolveWebEmbeddedRegistrationUrl(
  host: string,
  tourId: string,
  pluginId: string
): string | null {
  const baseUrl = resolveWebRegistrationUrl(host, tourId, pluginId);
  if (baseUrl === null) {
    return null;
  }
  return `${baseUrl}?embed=marketing`;
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

export function resolveWebEmbeddedRegistrationLoginUrl(
  host: string,
  tourId: string,
  pluginId: string
): string | null {
  const loginUrl = resolveWebRegistrationLoginUrl(host, tourId, pluginId);
  if (loginUrl === null) {
    return null;
  }
  return `${loginUrl}&embed=marketing`;
}
