"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { MarketingSessionContext } from "./marketing-session-context";
import { parsePortalSessionProbe, SESSION_SYNC_INTERVAL_MS } from "./marketing-session-sync";

// Interval + request deadline leaves rendering time inside the five-second target.
const PROBE_TIMEOUT_MS = 2_000;

export function MarketingSessionSyncProvider({
  portalOrigin,
  authenticated,
  profileHref,
  children,
}: {
  readonly portalOrigin: string | null;
  readonly profileHref: string | null;
  readonly children: ReactNode;
  readonly authenticated: boolean;
}) {
  const router = useRouter();
  const [portalReady, setPortalReady] = useState(authenticated);

  // Refresh only after React commits the authoritative observation. Polling itself
  // must not repeatedly invalidate an in-progress server render.
  useEffect(() => {
    if (portalOrigin !== null && portalReady !== authenticated) router.refresh();
  }, [portalReady, authenticated, portalOrigin, router]);

  useEffect(() => {
    if (portalOrigin === null) return;
    let disposed = false;
    let activeRequest: AbortController | null = null;
    const check = async (reactivated = false) => {
      if (disposed || document.visibilityState !== "visible") return;
      if (activeRequest !== null) {
        if (!reactivated) return;
        // A pre-activation request may describe the old session. Do not let it
        // block a fresh observation, or let its completion replace the new one.
        activeRequest.abort();
      }
      const controller = new AbortController();
      activeRequest = controller;
      const timeout = window.setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
      try {
        const response = await fetch(`${portalOrigin}/api/public-auth/session`, {
          credentials: "include",
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) return;
        const ready = parsePortalSessionProbe(await response.json());
        if (disposed || activeRequest !== controller || ready === null) return;
        setPortalReady(ready);
        // A failed refresh can be retried on a later activation, without a
        // periodic refresh loop when a cookie cannot be shared with marketing.
        if (reactivated && ready === portalReady && ready !== authenticated) router.refresh();
      } catch {
        // A failed check is not evidence that the member has signed out.
      } finally {
        window.clearTimeout(timeout);
        if (activeRequest === controller) activeRequest = null;
      }
    };
    const poll = () => {
      void check();
    };
    const activate = () => {
      void check(true);
    };
    window.addEventListener("focus", activate);
    window.addEventListener("pageshow", activate);
    document.addEventListener("visibilitychange", activate);
    const interval = window.setInterval(poll, SESSION_SYNC_INTERVAL_MS);
    poll();
    return () => {
      disposed = true;
      activeRequest?.abort();
      window.clearInterval(interval);
      window.removeEventListener("focus", activate);
      window.removeEventListener("pageshow", activate);
      document.removeEventListener("visibilitychange", activate);
    };
  }, [portalOrigin, portalReady, authenticated, router]);

  const value = useMemo(
    () => ({ authenticated: portalReady, profileHref }),
    [portalReady, profileHref]
  );
  return (
    <MarketingSessionContext.Provider value={value}>{children}</MarketingSessionContext.Provider>
  );
}
