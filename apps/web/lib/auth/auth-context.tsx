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
import { clearSessionToken, getSessionToken, setSessionToken } from "./session";
import type { WebSessionResponseBody } from "./types";

export type AuthUser = {
  userId: string;
  tenantId: string;
  /** From JWT `role` claim (`owner` | `admin` | `member`, …). */
  role?: string;
};

export function isLeaderRole(role?: string): boolean {
  const r = (role ?? "").trim().toLowerCase();
  return r === "owner" || r === "admin";
}

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
  setSession: (session: WebSessionResponseBody) => void;
  clearSession: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function hydrateUserFromToken(token: string): AuthUser | null {
  const claims = decodeJwtPayload(token);
  const userId = typeof claims?.sub === "string" ? claims.sub.trim() : "";
  const tenantId = typeof claims?.tenant_id === "string" ? claims.tenant_id.trim() : "";
  if (!userId || !tenantId) {
    return null;
  }
  const role = typeof claims?.role === "string" ? claims.role.trim() : undefined;
  return { userId, tenantId, role };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    try {
      const token = getSessionToken();
      if (!token) {
        setUser(null);
        return;
      }
      const hydrated = hydrateUserFromToken(token);
      if (!hydrated) {
        clearSessionToken();
        setUser(null);
        return;
      }
      setUser(hydrated);
    } finally {
      setIsHydrated(true);
    }
  }, []);

  const setSession = useCallback((session: WebSessionResponseBody) => {
    setSessionToken(session.session_token);
    const claims = decodeJwtPayload(session.session_token);
    const role = typeof claims?.role === "string" ? claims.role.trim() : undefined;
    setUser({ userId: session.user_id, tenantId: session.tenant_id, role });
  }, []);

  const clearSession = useCallback(() => {
    clearSessionToken();
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
