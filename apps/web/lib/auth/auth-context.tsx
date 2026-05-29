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
import {
  applySessionHydratePayload,
  isAbortError,
  isSessionHydrateFetchFailure,
  type SessionHydrateUser,
  type SessionHydrateWire,
  warnAuthHydrateTimeout,
  warnSessionHydrate,
} from "./session-hydrate";
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

/**
 * Session state for workspace UI. Gate BFF React Query hooks with
 * `isHydrated && isAuthenticated` via {@link useAuthBffQueryGate} (`@/hooks/use-auth-bff-query-gate`).
 */
type AuthContextValue = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  /** True after client-side cookie/session hydration finishes (always safe for gated queries). */
  isHydrated: boolean;
  setSession: (_session: WebSessionResponseBody) => Promise<void>;
  clearSession: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const SESSION_HYDRATE_PATH = "/api/auth/session";
const SESSION_HYDRATE_TIMEOUT_MS = 8_000;

async function fetchSessionHydrate(signal?: AbortSignal): Promise<Response> {
  return inflightBffGet(SESSION_HYDRATE_PATH, () =>
    fetch(SESSION_HYDRATE_PATH, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      ...(signal ? { signal } : {}),
    }),
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const prevTenantIdRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    let hydrateTimedOut = false;
    const ac = new AbortController();
    const tid = window.setTimeout(() => {
      hydrateTimedOut = true;
      ac.abort();
    }, SESSION_HYDRATE_TIMEOUT_MS);

    const applyMembershipContext = (userId: string, tenantId: string, signal?: AbortSignal) => {
      void fetchMembershipAbilityContext(signal).then((ctx) => {
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
            capabilities: ctx.capabilities.length > 0 ? ctx.capabilities : null,
            allowedRegionIds:
              (ctx.allowed_region_ids?.length ?? 0) > 0 ? ctx.allowed_region_ids : null,
            tenantModules: (ctx.tenant_modules?.length ?? 0) > 0 ? ctx.tenant_modules : null,
          };
        });
      });
    };

    /** Only `authenticated: false` may clear `user`; never on transient/network errors. */
    const consumeHydrateResponse = async (response: Response): Promise<void> => {
      if (!response.ok) {
        warnSessionHydrate(
          `session hydrate HTTP ${response.status} — keeping cookie, not clearing user`,
        );
        return;
      }

      const payload = (await response.json().catch(() => ({}))) as SessionHydrateWire;
      if (!active) {
        return;
      }

      if (payload.authenticated !== true) {
        applySessionHydratePayload(payload);
        setUser(null);
        return;
      }

      const hydratedUser: SessionHydrateUser | null = applySessionHydratePayload(payload);
      if (hydratedUser) {
        setUser(hydratedUser);
        applyMembershipContext(hydratedUser.userId, hydratedUser.tenantId);
      }
    };

    const runBackgroundHydrateRetry = () => {
      void (async () => {
        try {
          const response = await fetchSessionHydrate();
          if (!active) {
            return;
          }
          await consumeHydrateResponse(response);
        } catch (error: unknown) {
          if (!active) {
            return;
          }
          warnSessionHydrate("background session hydrate retry failed — cookie retained", error);
        }
      })();
    };

    const resolveHydrateFetchError = (error: unknown): "done" | "retry-inline" => {
      if (!active) {
        return "done";
      }
      if (isAbortError(error)) {
        if (hydrateTimedOut) {
          warnAuthHydrateTimeout(error);
          runBackgroundHydrateRetry();
        }
        return "done";
      }
      if (!isSessionHydrateFetchFailure(error)) {
        warnSessionHydrate("session hydrate failed — cookie retained", error);
        return "done";
      }
      warnSessionHydrate("session hydrate fetch failed — retrying once without abort", error);
      return "retry-inline";
    };

    void (async () => {
      try {
        let response: Response | undefined;
        try {
          response = await fetchSessionHydrate(ac.signal);
        } catch (error: unknown) {
          const action = resolveHydrateFetchError(error);
          if (action === "retry-inline") {
            try {
              response = await fetchSessionHydrate();
            } catch (retryError: unknown) {
              resolveHydrateFetchError(retryError);
              runBackgroundHydrateRetry();
            }
          }
        }

        if (response) {
          await consumeHydrateResponse(response);
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
