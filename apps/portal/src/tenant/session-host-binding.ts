import {
  resolveTenantIdFromDevHost,
  resolveTenantIdFromIngressLabel,
} from "@app-tour/guest-surface-host";

import { isDevWebSessionAllowed } from "./auth-env";
import { resolveProductionIngressLabelFromHost } from "./resolve-production-ingress-label";

export function resolveExpectedTenantIdForHost(host: string): string | null {
  const hostMapped = resolveTenantIdFromDevHost(host, "portal");
  if (hostMapped !== null) {
    return hostMapped;
  }

  if (!isDevWebSessionAllowed()) {
    const label = resolveProductionIngressLabelFromHost(host);
    if (label !== null) {
      return resolveTenantIdFromIngressLabel(label);
    }
  }

  return null;
}

/** True when member JWT tenant matches portal host (fail-open when host is unmapped). */
export function sessionTenantMatchesHost(sessionTenantId: string, host: string): boolean {
  const expected = resolveExpectedTenantIdForHost(host);
  if (expected !== null) {
    return sessionTenantId.trim() === expected;
  }
  return true;
}
