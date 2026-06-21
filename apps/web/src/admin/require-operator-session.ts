/**
 * Phase 9.1 — operator session gate (sync with CANLOAD-OPERATOR-SESSION.contract.ts)
 */
import type { TenantAuthz } from "@app-tour/workspace-sdk";

import { isExtendedOperatorWorkspace } from "@/workspace/is-extended-operator-workspace";
import { sessionTenantMatchesHost } from "@/tenant/session-host-binding";

export const OPERATOR_APP_ROUTE_PREFIX = "/(app)" as const;
export const OPERATOR_LOGIN_PATH = "/auth/login" as const;
export const OPERATOR_LOGIN_ALIAS_PATH = "/login" as const;
export const OPERATOR_DASHBOARD_PATH = "/dashboard" as const;
export const SESSION_COOKIE_NAME = "session" as const;
export const SESSION_COOKIE_MAX_AGE_SECONDS = 604_800 as const;
export const SESSION_LOCAL_STORAGE_PREFIX = "tour_ops_session_token:" as const;
export const OPERATOR_WIZARD_PATH = "/tours/new" as const;

/** Query param `access=owner-only` — non-owner attempted owner panel login (DEC-P9-018). */
export const OPERATOR_OWNER_PANEL_ACCESS_QUERY = "owner-only" as const;

export type OperatorSessionContext = {
  readonly userId: string;
  readonly tenantId: string;
  readonly role: "owner" | "admin" | "member" | "viewer";
  readonly workspaceType: string;
  readonly pluginId: string;
};

export function isDenaliOperatorSession(session: OperatorSessionContext): boolean {
  return (
    isExtendedOperatorWorkspace(session.pluginId) ||
    isExtendedOperatorWorkspace(session.workspaceType)
  );
}

export type RequireOperatorSessionWebParams = {
  readonly session: OperatorSessionContext | null;
  readonly pathname: string;
  readonly host?: string;
};

export type RequireOperatorSessionWebResult =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly redirectTo: string };

export function isOwnerRole(role: OperatorSessionContext["role"]): boolean {
  return role === "owner";
}

export function requireOperatorSessionWeb(
  params: RequireOperatorSessionWebParams
): RequireOperatorSessionWebResult {
  if (params.session !== null && params.session.userId.trim().length > 0) {
    const host = params.host?.trim() ?? "";
    if (host.length > 0 && !sessionTenantMatchesHost(params.session.tenantId, host)) {
      return {
        allowed: false,
        redirectTo: `${OPERATOR_LOGIN_PATH}?access=tenant-mismatch`,
      };
    }
    if (!isOwnerRole(params.session.role)) {
      return {
        allowed: false,
        redirectTo: `${OPERATOR_LOGIN_PATH}?access=${OPERATOR_OWNER_PANEL_ACCESS_QUERY}`,
      };
    }
    return { allowed: true };
  }
  const returnUrl = encodeURIComponent(params.pathname);
  return {
    allowed: false,
    redirectTo: `${OPERATOR_LOGIN_PATH}?returnUrl=${returnUrl}`,
  };
}

export function canAccessOperatorShell(authz: TenantAuthz, tenantId: string): boolean {
  return authz.canReadTenant(tenantId);
}
