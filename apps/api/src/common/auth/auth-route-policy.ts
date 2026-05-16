/**
 * Canonical auth session routes used by middleware/policies/metrics.
 * Keep this file as the single source of truth to avoid drift.
 */
export const AUTH_SESSION_LOGIN_ROUTES = [
  "/api/v2/auth/web/session/otp",
  "/api/v2/auth/telegram/session",
  "/api/v2/auth/web/phone/preflight",
  "/api/v2/auth/web/otp/request",
  "/api/v2/auth/web/registration/complete"
] as const;

export const AUTH_WORKSPACE_SESSION_ROUTE = "/api/v2/auth/workspace/session";
export const AUTH_WORKSPACES_ROUTE = "/api/v2/auth/workspaces";
/** Lightweight Host→tenant existence probe (GET, no body). Used by web middleware lookup. */
export const AUTH_WORKSPACE_HOST_PROBE_ROUTE = "/api/v2/auth/workspace-host";

export const AUTH_PUBLIC_HOST_PROBE_ROUTES = [AUTH_WORKSPACE_HOST_PROBE_ROUTE] as const;

export function isAuthSessionLoginRoute(path: string, method: string): boolean {
  return method === "POST" && AUTH_SESSION_LOGIN_ROUTES.some((route) => path === route);
}

/** Routes that require strict Host → tenant resolution (login + workspace session exchange). */
export function isAuthPublicHostProbeRoute(path: string, method: string): boolean {
  return method === "GET" && AUTH_PUBLIC_HOST_PROBE_ROUTES.some((route) => path === route);
}

export function isAuthTenantHostStrictRoute(path: string, method: string): boolean {
  return (
    isAuthSessionLoginRoute(path, method) ||
    (method === "POST" && path === AUTH_WORKSPACE_SESSION_ROUTE) ||
    isAuthPublicHostProbeRoute(path, method)
  );
}

