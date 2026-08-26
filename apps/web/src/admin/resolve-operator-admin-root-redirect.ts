import { OPERATOR_DASHBOARD_PATH } from "@/admin/require-operator-session";
import { isOperatorAdminIngressHost } from "@/tenant/operator-admin-host";

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
  if (!isOperatorAdminIngressHost(input.host)) {
    return null;
  }
  return OPERATOR_DASHBOARD_PATH;
}
