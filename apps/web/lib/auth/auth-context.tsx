"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { inflightBffGet } from "./inflight-bff-get";
import { decodeJwtPayload } from "./decode-jwt-payload";
import { fetchMembershipAbilityContext } from "./membership-ability-context";
import { clearSessionToken, persistSessionToken } from "./session";
import type { WebSessionResponseBody } from "./types";

export { isLeaderRole, isParticipantRole, isWorkspaceOwner } from "./role-tags";

export type AuthUser = {
  userId: string;
  tenantId: string;
  /** From JWT `role` claim (`owner` | `admin` | `leader` | `member` | `viewer`, …). */
  role?: string;
  /** When set, passed into CASL `defineAbilityFor` (defaults to ACTIVE if omitted). */
  membershipStatus?: string;
  /** Optional marketing / CRM labels for CASL (future: hydrate from API). */
  abilityLabels?: readonly string[] | null;
  /** Optional explicit capability grants (membership row / session). */
  capabilities?: readonly string[] | null;
  /** Regional scope when actor has `tour.regional.manage`. */
  allowedRegionIds?: readonly string[] | null;
  /** Tenant product modules from API hydration. */
  tenantModules?: readonly string[] | null;
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
  const prevTenantIdRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    const ac = new AbortController();
    const timeoutMs = 8_000;
    const tid = window.setTimeout(() => ac.abort(), timeoutMs);
    void (async () => {
      try {
        const response = await inflightBffGet("/api/auth/session", () =>
          fetch("/api/auth/session", {
            method: "GET",
            credentials: "include",
            cache: "no-store",
            signal: ac.signal,
          }),
        );
        const payload = (await response.json().catch(() => ({}))) as {
          authenticated?: boolean;
          user?: AuthUser;
          user_id?: string;
          tenant_id?: string;
          session_token?: string;
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
          const tokenForClaims =
            typeof payload.session_token === "string" ? payload.session_token.trim() : "";
          const roleFromJwt =
            tokenForClaims !== "" ? decodeJwtPayload(tokenForClaims)?.role : undefined;
          const role =
            payload.user?.role ||
            (typeof payload.decoded?.payload?.role === "string"
              ? payload.decoded.payload.role.trim()
              : undefined) ||
            (typeof roleFromJwt === "string" ? roleFromJwt.trim() : undefined);
          if (!userId || !tenantId) {
            setUser(null);
          } else {
            const baseUser = { userId, tenantId, role };
            setUser(baseUser);
            void fetchMembershipAbilityContext(ac.signal).then((ctx) => {
              if (!active || !ctx) {
                return;
              }
              setUser((prev) => {
                if (!prev || prev.userId !== userId || prev.tenantId !== tenantId) {
                  return prev;
                }
                return {
                  ...prev,
                  abilityLabels: ctx.labels.length > 0 ? ctx.labels : null,
                  capabilities:
                    ctx.capabilities.length > 0 ? ctx.capabilities : null,
                  allowedRegionIds:
                    (ctx.allowed_region_ids?.length ?? 0) > 0
                      ? ctx.allowed_region_ids
                      : null,
                  tenantModules:
                    (ctx.tenant_modules?.length ?? 0) > 0 ? ctx.tenant_modules : null,
                };
              });
            });
          }
        }
      } catch {
        if (active) {
          setUser(null);
        }
      } finally {
        window.clearTimeout(tid);
        if (active) {
          setIsHydrated(true);
        }
      }
    })();
    return () => {
      active = false;
      ac.abort();
      window.clearTimeout(tid);
    };
  }, []);

  useEffect(() => {
    prevTenantIdRef.current = user?.tenantId?.trim() || null;
  }, [user?.tenantId]);

  const setSession = useCallback(async (session: WebSessionResponseBody) => {
    await persistSessionToken(session.session_token);
    const claims = decodeJwtPayload(session.session_token);
    const role = typeof claims?.role === "string" ? claims.role.trim() : undefined;
    const baseUser = {
      userId: session.user_id,
      tenantId: session.tenant_id,
      role,
    };
    setUser(baseUser);
    const ctx = await fetchMembershipAbilityContext();
    if (ctx) {
      setUser({
        ...baseUser,
        abilityLabels: ctx.labels.length > 0 ? ctx.labels : null,
        capabilities: ctx.capabilities.length > 0 ? ctx.capabilities : null,
        allowedRegionIds:
          (ctx.allowed_region_ids?.length ?? 0) > 0 ? ctx.allowed_region_ids : null,
        tenantModules: (ctx.tenant_modules?.length ?? 0) > 0 ? ctx.tenant_modules : null,
      });
    }
  }, []);

  const clearSession = useCallback(async () => {
    await clearSessionToken();
    setUser(null);
    prevTenantIdRef.current = null;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isHydrated,
      setSession,
      clearSession,
    }),
    [user, isHydrated, setSession, clearSession],
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
