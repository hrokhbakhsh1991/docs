"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { decodeJwtPayload } from "./decode-jwt-payload";
import { clearSessionToken, persistSessionToken } from "./session";
import type { WebSessionResponseBody } from "./types";

export { isLeaderRole, isParticipantRole } from "./role-tags";

export type AuthUser = {
  userId: string;
  tenantId: string;
  /** From JWT `role` claim (`owner` | `admin` | `member`, …). */
  role?: string;
};

/** Canonical copy when the UI exposes leader-only tooling (owner / admin; participants excluded). */
export const LEADER_WORKSPACE_ACCESS_DENIED = {
  title: "Leader access only",
  description: "This workspace is restricted to tenant owners and admins.",
} as const;

type AuthContextValue = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  /** True after client-side cookie/session hydration finishes (always safe for gated queries). */
  isHydrated: boolean;
  setSession: (session: WebSessionResponseBody) => Promise<void>;
  clearSession: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      // #region agent log
      fetch("http://127.0.0.1:7323/ingest/c60f1c6f-cda4-48f9-ac76-d6e5407c03d1", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Debug-Session-Id": "770f2e"
        },
        body: JSON.stringify({
          sessionId: "770f2e",
          runId: "initial",
          hypothesisId: "H7",
          location: "lib/auth/auth-context.tsx:49",
          message: "auth_hydration_effect_started",
          data: { active_before_fetch: active },
          timestamp: Date.now()
        })
      }).catch(() => {});
      // #endregion
      try {
        const response = await fetch("/api/auth/session", {
          method: "GET",
          credentials: "include",
          cache: "no-store"
        });
        const payload = (await response.json().catch(() => ({}))) as {
          authenticated?: boolean;
          user?: AuthUser;
          user_id?: string;
          tenant_id?: string;
          decoded?: { payload?: { role?: unknown } };
        };
        // #region agent log
        fetch("http://127.0.0.1:7323/ingest/c60f1c6f-cda4-48f9-ac76-d6e5407c03d1", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Debug-Session-Id": "770f2e"
          },
          body: JSON.stringify({
            sessionId: "770f2e",
            runId: "initial",
            hypothesisId: "H1",
            location: "lib/auth/auth-context.tsx:56",
            message: "auth_session_fetch_result",
            data: {
              status: response.status,
              authenticated: payload.authenticated === true,
              has_user_object: Boolean(payload.user),
              has_user_id_field: typeof payload.user_id === "string",
              has_tenant_id_field: typeof payload.tenant_id === "string",
              has_decoded_payload: Boolean(payload.decoded?.payload)
            },
            timestamp: Date.now()
          })
        }).catch(() => {});
        // #endregion
        void response;
        if (!active) {
          return;
        }
        if (!payload.authenticated) {
          setUser(null);
        } else {
          const userId =
            payload.user?.userId?.trim() ||
            (typeof payload.user_id === "string" ? payload.user_id.trim() : "");
          const tenantId =
            payload.user?.tenantId?.trim() ||
            (typeof payload.tenant_id === "string" ? payload.tenant_id.trim() : "");
          const role =
            payload.user?.role ||
            (typeof payload.decoded?.payload?.role === "string"
              ? payload.decoded.payload.role.trim()
              : undefined);
          if (!userId || !tenantId) {
            // #region agent log
            fetch("http://127.0.0.1:7323/ingest/c60f1c6f-cda4-48f9-ac76-d6e5407c03d1", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Debug-Session-Id": "770f2e"
              },
              body: JSON.stringify({
                sessionId: "770f2e",
                runId: "initial",
                hypothesisId: "H1",
                location: "lib/auth/auth-context.tsx:77",
                message: "auth_session_missing_identity_fields",
                data: {
                  resolved_user_id: userId,
                  resolved_tenant_id: tenantId
                },
                timestamp: Date.now()
              })
            }).catch(() => {});
            // #endregion
            setUser(null);
          } else {
            // #region agent log
            fetch("http://127.0.0.1:7323/ingest/c60f1c6f-cda4-48f9-ac76-d6e5407c03d1", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Debug-Session-Id": "770f2e"
              },
              body: JSON.stringify({
                sessionId: "770f2e",
                runId: "initial",
                hypothesisId: "H1",
                location: "lib/auth/auth-context.tsx:91",
                message: "auth_user_hydrated",
                data: {
                  has_user: true,
                  role: role ?? null
                },
                timestamp: Date.now()
              })
            }).catch(() => {});
            // #endregion
            setUser({
              userId,
              tenantId,
              role
            });
          }
        }
      } catch {
        if (!active) {
          return;
        }
        setUser(null);
      }
      if (active) {
        setIsHydrated(true);
        // #region agent log
        fetch("http://127.0.0.1:7323/ingest/c60f1c6f-cda4-48f9-ac76-d6e5407c03d1", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Debug-Session-Id": "770f2e"
          },
          body: JSON.stringify({
            sessionId: "770f2e",
            runId: "initial",
            hypothesisId: "H7",
            location: "lib/auth/auth-context.tsx:97",
            message: "auth_hydration_effect_completed",
            data: { is_hydrated_set_true: true, active_state: active },
            timestamp: Date.now()
          })
        }).catch(() => {});
        // #endregion
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const setSession = useCallback(async (session: WebSessionResponseBody) => {
    // #region agent log
    fetch("http://127.0.0.1:7323/ingest/c60f1c6f-cda4-48f9-ac76-d6e5407c03d1", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "770f2e"
      },
      body: JSON.stringify({
        sessionId: "770f2e",
        runId: "initial",
        hypothesisId: "H9",
        location: "lib/auth/auth-context.tsx:210",
        message: "auth_context_set_session_enter",
        data: {
          has_session_token: typeof session.session_token === "string" && session.session_token.length > 0,
          user_id: session.user_id,
          tenant_id: session.tenant_id
        },
        timestamp: Date.now()
      })
    }).catch(() => {});
    // #endregion
    await persistSessionToken(session.session_token);
    const claims = decodeJwtPayload(session.session_token);
    const role = typeof claims?.role === "string" ? claims.role.trim() : undefined;
    setUser({
      userId: session.user_id,
      tenantId: session.tenant_id,
      role
    });
  }, []);

  const clearSession = useCallback(async () => {
    await clearSessionToken();
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isHydrated,
      setSession,
      clearSession,
    }),
    [user, isHydrated, setSession, clearSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
