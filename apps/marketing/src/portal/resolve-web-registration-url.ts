import { supportsCatalogRegistration } from "@app-tour/workspace-sdk";

import {
  resolvePortalPublicBaseUrl,
  resolvePortalRegistrationUrl,
  resolvePortalMemberModuleUrl,
} from "@app-tour/guest-surface-host";

export { supportsCatalogRegistration };

export { resolvePortalPublicBaseUrl, resolvePortalRegistrationUrl, resolvePortalMemberModuleUrl };

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
