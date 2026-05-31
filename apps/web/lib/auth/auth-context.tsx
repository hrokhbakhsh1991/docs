"use client";

/* eslint-disable no-console -- dev-only auth audit logging */
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

import { bffBrowserFetch, cancelInflightBffGets, inflightBffGet } from "./inflight-bff-get";
import { evictWorkspaceQueryCaches } from "@/lib/query/evict-workspace-query-cache";
import { decodeJwtPayload } from "./decode-jwt-payload";
import { fetchMembershipAbilityContext } from "./membership-ability-context";
import {
  applySessionHydratePayload,
  isAbortError,
  isSessionHydrateFetchFailure,
  type SessionHydrateUser,
  type SessionHydrateWire,
  warnSessionHydrate,
} from "./session-hydrate";
import { clearSessionToken, getStoredSessionToken, persistSessionToken, buildSessionTokenStorageKey } from "./session";
import { formatAuthAuditLabel, validateSessionToken } from "./validate-session-token";
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
const SESSION_HYDRATE_TIMEOUT_MS = 12_000;
const HYDRATE_MAX_ATTEMPTS = 5;
const HYDRATE_BASE_DELAY_MS = 400;

function logAuthAudit(source: "middleware" | "AuthProvider", label: string): void {
  console.log(`Auth Audit: ${label}`, { source });
}

function isPublicAuthBrowserRoute(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  const path = window.location.pathname;
  return (
    path === "/login" ||
    path.startsWith("/auth/login") ||
    path.startsWith("/auth/register") ||
    path.startsWith("/auth/invite")
  );
}

function hydrateBackoffDelayMs(attemptIndex: number): number {
  return HYDRATE_BASE_DELAY_MS * 2 ** attemptIndex;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

type SessionHydrateFetchResult = {
  ok: boolean;
  status: number;
  payload: SessionHydrateWire;
};

async function fetchSessionHydrate(signal?: AbortSignal): Promise<SessionHydrateFetchResult> {
  return inflightBffGet(SESSION_HYDRATE_PATH, async () => {
    const response = await bffBrowserFetch(SESSION_HYDRATE_PATH, {
      method: "GET",
      ...(signal ? { signal } : {}),
    });
    const payload = (await response.json().catch(() => ({}))) as SessionHydrateWire;
    return { ok: response.ok, status: response.status, payload };
  });
}

async function fetchSessionHydrateWithTimeout(signal?: AbortSignal): Promise<SessionHydrateFetchResult> {
  const ac = new AbortController();
  const tid = window.setTimeout(() => ac.abort(), SESSION_HYDRATE_TIMEOUT_MS);
  const onParentAbort = () => ac.abort();
  signal?.addEventListener("abort", onParentAbort, { once: true });
  try {
    return await fetchSessionHydrate(ac.signal);
  } finally {
    window.clearTimeout(tid);
    signal?.removeEventListener("abort", onParentAbort);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const switchGenerationRef = useRef(0);
  const membershipSwitchAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const middlewareAudit = document.documentElement.getAttribute("data-auth-audit");
    if (middlewareAudit === "valid") {
      logAuthAudit("middleware", "Token found");
    } else if (middlewareAudit) {
      logAuthAudit("middleware", "Token missing");
    }
  }, []);

  useEffect(() => {
    let active = true;
    const hydrateAbort = new AbortController();

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
    const consumeHydrateResponse = async (
      result: SessionHydrateFetchResult,
    ): Promise<"authenticated" | "unauthenticated" | "transient"> => {
      if (!result.ok) {
        warnSessionHydrate(
          `session hydrate HTTP ${result.status} — keeping cookie, not clearing user`,
        );
        return "transient";
      }

      const payload = result.payload;
      if (!active) {
        return "transient";
      }

      if (payload.authenticated !== true) {
        applySessionHydratePayload(payload);
        setUser(null);
        return "unauthenticated";
      }

      const tokenForValidation =
        typeof payload.session_token === "string" ? payload.session_token.trim() : "";
      const validation = validateSessionToken(tokenForValidation);
      if (validation.status !== "valid") {
        applySessionHydratePayload({ authenticated: false });
        setUser(null);
        return "unauthenticated";
      }

      const hydratedUser: SessionHydrateUser | null = applySessionHydratePayload(payload);
      if (hydratedUser) {
        setUser(hydratedUser);
        applyMembershipContext(hydratedUser.userId, hydratedUser.tenantId);
        return "authenticated";
      }

      return "transient";
    };

    void (async () => {
      let lastOutcome: "authenticated" | "unauthenticated" | "transient" = "transient";

      for (let attempt = 0; attempt < HYDRATE_MAX_ATTEMPTS && active; attempt += 1) {
        if (hydrateAbort.signal.aborted) {
          break;
        }
        if (attempt > 0) {
          await sleep(hydrateBackoffDelayMs(attempt - 1));
          if (!active || hydrateAbort.signal.aborted) {
            break;
          }
        }

        try {
          const hydrateResult = await fetchSessionHydrateWithTimeout(hydrateAbort.signal);
          if (!active || hydrateAbort.signal.aborted) {
            break;
          }
          lastOutcome = await consumeHydrateResponse(hydrateResult);
          if (lastOutcome === "authenticated" || lastOutcome === "unauthenticated") {
            break;
          }
        } catch (error: unknown) {
          if (!active || hydrateAbort.signal.aborted) {
            break;
          }
          const transient =
            isAbortError(error) || isSessionHydrateFetchFailure(error) || error instanceof TypeError;
          if (transient) {
            warnSessionHydrate(
              `session hydrate attempt ${attempt + 1}/${HYDRATE_MAX_ATTEMPTS} failed — retrying`,
              error,
            );
            lastOutcome = "transient";
            continue;
          }
          warnSessionHydrate("session hydrate failed — cookie retained", error);
          lastOutcome = "transient";
          break;
        }
      }

      if (active) {
        if (lastOutcome === "authenticated") {
          logAuthAudit("AuthProvider", "Token found");
        } else if (isPublicAuthBrowserRoute()) {
          console.log("Auth Audit: No session yet (public route — expected before login)", {
            source: "AuthProvider",
            hydrateOutcome: lastOutcome,
          });
        } else {
          const storedToken = getStoredSessionToken();
          const clientValidation = validateSessionToken(storedToken);
          logAuthAudit(
            "AuthProvider",
            formatAuthAuditLabel(
              clientValidation.status === "valid" ? clientValidation : { status: "missing" },
            ),
          );
        }
        setIsHydrated(true);
      }
    })();

    return () => {
      active = false;
      hydrateAbort.abort();
      cancelInflightBffGets();
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleStorageSync = (event: StorageEvent) => {
      if (event.storageArea !== window.localStorage) {
        return;
      }
      const tokenHint =
        event.newValue?.trim() ||
        event.oldValue?.trim() ||
        getStoredSessionToken() ||
        undefined;
      const activeMirrorKey = buildSessionTokenStorageKey(undefined, tokenHint);
      if (event.key !== activeMirrorKey) {
        return;
      }

      const incoming = event.newValue?.trim() ?? "";
      const outgoing = event.oldValue?.trim() ?? "";

      if (!incoming) {
        setUser(null);
        logAuthAudit("AuthProvider", "Token missing");

        if (!isPublicAuthBrowserRoute()) {
          window.location.assign("/login");
        }
        return;
      }

      if (incoming !== outgoing) {
        window.location.reload();
      }
    };

    window.addEventListener("storage", handleStorageSync);
    return () => {
      window.removeEventListener("storage", handleStorageSync);
    };
  }, []);

  const setSession = useCallback(async (session: WebSessionResponseBody) => {
    membershipSwitchAbortRef.current?.abort();
    const switchAbort = new AbortController();
    membershipSwitchAbortRef.current = switchAbort;
    const switchGeneration = switchGenerationRef.current + 1;
    switchGenerationRef.current = switchGeneration;

    evictWorkspaceQueryCaches();
    cancelInflightBffGets();
    await persistSessionToken(session.session_token);
    const claims = decodeJwtPayload(session.session_token);
    const role = typeof claims?.role === "string" ? claims.role.trim() : undefined;
    const baseUser = {
      userId: session.user_id,
      tenantId: session.tenant_id,
      role,
    };
    const targetTenantId = baseUser.tenantId;
    if (switchGenerationRef.current !== switchGeneration || switchAbort.signal.aborted) {
      return;
    }
    evictWorkspaceQueryCaches();
    cancelInflightBffGets();
    setUser(baseUser);
    const ctx = await fetchMembershipAbilityContext(switchAbort.signal);
    if (switchGenerationRef.current !== switchGeneration || switchAbort.signal.aborted) {
      return;
    }
    if (ctx) {
      setUser((prev) => {
        if (!prev || prev.tenantId !== targetTenantId) {
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
    }
    logAuthAudit("AuthProvider", "Token found");
  }, []);

  const clearSession = useCallback(async () => {
    membershipSwitchAbortRef.current?.abort();
    switchGenerationRef.current += 1;
    await clearSessionToken();
    setUser(null);
    logAuthAudit("AuthProvider", "Token missing");
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
