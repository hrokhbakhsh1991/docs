import { OPERATOR_DASHBOARD_PATH } from "@/admin/require-operator-session";
import { isOperatorAdminHost } from "@/tenant/operator-admin-host";
import {
  normalizeHostHeader,
  readPlatformRootDomainWeb,
  readWebReservedHostLabels,
} from "@/tenant/platform-host-env";
import { resolveProductionIngressLabelFromHost } from "@/tenant/resolve-production-ingress-label";
import { parseMultiLevelTenantHost } from "@app-tour/tenant-kernel/host-only";

/**
 * Profile B bare-IP / localhost fallback ingress — operator routes allowed, but only when
 * the host is not a WRS multi-level tenant surface (apex/portal/admin have their own roots).
 */
function isProfileBFallbackAdminRootHost(host: string): boolean {
  if (resolveProductionIngressLabelFromHost(host) === null) {
    return false;
  }
  const hostname = normalizeHostHeader(host).split(":")[0]?.trim().toLowerCase() ?? "";
  const outcome = parseMultiLevelTenantHost(
    hostname,
    readPlatformRootDomainWeb(),
    readWebReservedHostLabels()
  );
  return (
    outcome.kind !== "club_admin" &&
    outcome.kind !== "club_portal" &&
    outcome.kind !== "club_apex"
  );
}

/**
 * Club operator admin hosts (`{club}.admin.{root}`) have no public surface —
 * marketing and portal are separate apps.
 */
export function resolveOperatorAdminRootRedirect(input: {
  readonly pathname: string;
  readonly host: string;
}): string | null {
  if (input.pathname !== "/") {
    return null;
  }
  if (!isOperatorAdminHost(input.host) && !isProfileBFallbackAdminRootHost(input.host)) {
    return null;
  }
  return OPERATOR_DASHBOARD_PATH;
}
