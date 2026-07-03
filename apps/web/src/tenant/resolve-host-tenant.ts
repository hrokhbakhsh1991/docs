import {
  resolveTenantIdFromDevHost as resolveGuestDevHostTenantId,
  resolveTenantIdFromIngressLabel,
} from "@app-tour/guest-surface-host";

import { isDevWebSessionAllowed } from "./auth-env";

export { resolveTenantIdFromIngressLabel };

/**
 * Dev-only: map operator admin / portal / legacy apex hosts to seeded tenant UUID.
 * Delegates to `@app-tour/guest-surface-host` (WRS — single PHASE_43 map).
 */
export function resolveTenantIdFromDevHost(host: string): string | null {
  if (!isDevWebSessionAllowed()) {
    return null;
  }
  return resolveGuestDevHostTenantId(host, "admin");
}
