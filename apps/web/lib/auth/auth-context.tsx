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

export { isLeaderRole, isParticipantRole, isWorkspaceOwner } from "./role-tags";

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
            setUser(null);
          } else {
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
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const setSession = useCallback(async (session: WebSessionResponseBody) => {
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
