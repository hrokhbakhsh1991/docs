/**
 * Phase 9.1 contract — canonical source for apps/web/src/admin/require-operator-session.ts
 * Authority: docs/phase-9/appendices/CASL-OPERATOR-SPEC.md · DEC-P9-007
 */
import type { TenantAuthz } from "@app-tour/workspace-sdk";

export const OPERATOR_APP_ROUTE_PREFIX = "/(app)" as const;

export const OPERATOR_LOGIN_PATH = "/auth/login" as const;

/** Middleware redirect target (legacy parity) */
export const OPERATOR_LOGIN_ALIAS_PATH = "/login" as const;

export const OPERATOR_DASHBOARD_PATH = "/dashboard" as const;

/** HttpOnly session cookie — legacy SESSION_TOKEN_COOKIE */
export const SESSION_COOKIE_NAME = "session" as const;

/** 7 days — must match JWT TTL and legacy SESSION_COOKIE_MAX_AGE_SECONDS */
export const SESSION_COOKIE_MAX_AGE_SECONDS = 604_800 as const;

/** localStorage key pattern: tour_ops_session_token:{tenantSlug} */
export const SESSION_LOCAL_STORAGE_PREFIX = "tour_ops_session_token:" as const;

/** Phase 6 wizard — canonical URL (DEC-P9-007); not under (app)/tours/new */
export const OPERATOR_WIZARD_PATH = "/tours/new" as const;

export type OperatorSessionContext = {
  readonly userId: string;
  readonly tenantId: string;
  readonly role: "owner" | "admin" | "member";
  readonly workspaceType: string;
};

export type RequireOperatorSessionWebParams = {
  readonly session: OperatorSessionContext | null;
  readonly pathname: string;
};

export type RequireOperatorSessionWebResult =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly redirectTo: string };

export function requireOperatorSessionWeb(
  params: RequireOperatorSessionWebParams
): RequireOperatorSessionWebResult {
  if (params.session !== null && params.session.userId.trim().length > 0) {
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

export const OPERATOR_APP_LAYOUT_MODULE = "apps/web/app/(app)/layout.tsx" as const;

export const OPERATOR_SESSION_ACCESS_MODULE =
  "apps/web/src/admin/require-operator-session.ts" as const;
