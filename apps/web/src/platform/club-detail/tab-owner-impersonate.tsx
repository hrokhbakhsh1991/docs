"use client";

import { useCallback, useState } from "react";

import { fetchPlatformApi } from "../platform-api-client";

export type TabOwnerImpersonateProps = {
  readonly tenantId: string;
  readonly adminLoginUrl: string;
};

export function TabOwnerImpersonate({ tenantId, adminLoginUrl }: TabOwnerImpersonateProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onViewAsClub = useCallback(async () => {
    const confirmed = window.confirm(
      "Open a read-only support view of this club operator panel in a new tab?"
    );
    if (!confirmed) {
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const response = await fetchPlatformApi(`/tenants/${tenantId}/impersonate`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      const body = (await response.json().catch(() => ({}))) as {
        sessionToken?: string;
        exchangePath?: string;
        error?: string;
      };
      if (!response.ok || !body.sessionToken || !body.exchangePath) {
        setError(body.error ?? "Failed to start impersonation");
        return;
      }

      const adminBase = adminLoginUrl.replace(/\/auth\/login\/?$/, "");
      const url = adminBase + body.exchangePath + "?token=" + encodeURIComponent(body.sessionToken);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      setError("Failed to start impersonation");
    } finally {
      setBusy(false);
    }
  }, [adminLoginUrl, tenantId]);

  return (
    <div className="space-y-2">
      <button
        type="button"
        data-platform-view-as-club
        className="inline-flex h-9 items-center rounded-md border border-border px-4 text-sm font-medium disabled:opacity-50"
        disabled={busy}
        onClick={() => void onViewAsClub()}
      >
        {busy ? "Starting…" : "View as club (read-only)"}
      </button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
