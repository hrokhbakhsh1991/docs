"use client";

import { useCallback, useEffect, useState } from "react";

import { Input } from "@app-tour/ui-primitives/input";

import { PlatformErrorState, PlatformLoadingState } from "../platform-async-states";
import { fetchPlatformApi } from "../platform-api-client";
import { domainSslDisplayBadge } from "./domain-ssl-display-badge";

export type TenantDomainRow = {
  readonly id: string;
  readonly hostname: string;
  readonly surface: string;
  readonly status: string;
  readonly cnameTarget: string;
  readonly sslStatus: string;
  readonly sslExpiresAt: string | null;
  readonly sslLastError: string | null;
};

export type TabDomainsProps = {
  readonly tenantId: string;
};

export function TabDomains({ tenantId }: TabDomainsProps) {
  const [items, setItems] = useState<readonly TenantDomainRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [hostname, setHostname] = useState("");
  const [surface, setSurface] = useState<"marketing" | "portal">("marketing");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadDomains = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchPlatformApi(`/tenants/${tenantId}/domains`);
      const body = (await response.json().catch(() => ({}))) as { items?: TenantDomainRow[] };
      if (!response.ok) {
        setError("Failed to load domains");
        return;
      }
      setItems(Array.isArray(body.items) ? body.items : []);
    } catch {
      setError("Failed to load domains");
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void loadDomains();
  }, [loadDomains]);

  const addDomain = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetchPlatformApi(`/tenants/${tenantId}/domains`, {
        method: "POST",
        body: JSON.stringify({ hostname, surface }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        cnameInstructions?: { cnameTarget?: string };
        error?: string;
      };
      if (!response.ok) {
        setError(body.error ?? "Failed to add domain");
        return;
      }
      setHostname("");
      await loadDomains();
    } catch {
      setError("Failed to add domain");
    } finally {
      setBusy(false);
    }
  }, [hostname, loadDomains, surface, tenantId]);

  const verifyDomain = useCallback(
    async (domainId: string) => {
      setBusy(true);
      setError(null);
      try {
        const response = await fetchPlatformApi(`/tenants/${tenantId}/domains/${domainId}/verify`, {
          method: "POST",
          body: "{}",
        });
        if (!response.ok) {
          const body = (await response.json().catch(() => ({}))) as { message?: string };
          setError(body.message ?? "Verification failed");
          return;
        }
        await loadDomains();
      } catch {
        setError("Verification failed");
      } finally {
        setBusy(false);
      }
    },
    [loadDomains, tenantId]
  );

  if (loading) {
    return (
      <div className="space-y-4" data-tab="domains">
        <PlatformLoadingState message="Loading domains…" />
      </div>
    );
  }

  return (
    <div className="space-y-4" data-tab="domains">
      {error ? <PlatformErrorState message={error} /> : null}
      <div className="rounded-lg border border-border p-4">
        <h2 className="mb-3 text-sm font-medium">Add custom domain</h2>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            className="h-9 flex-1 text-sm"
            placeholder="www.example.com"
            value={hostname}
            onChange={(event) => setHostname(event.target.value)}
          />
          <select
            className="h-9 rounded-md border border-border px-3 text-sm"
            value={surface}
            onChange={(event) => setSurface(event.target.value as "marketing" | "portal")}
          >
            <option value="marketing">Marketing</option>
            <option value="portal">Portal</option>
          </select>
          <button
            type="button"
            className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
            disabled={busy || hostname.trim().length === 0}
            onClick={addDomain}
          >
            Add
          </button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Create a CNAME record pointing your hostname to the platform target shown below.
        </p>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No custom domains configured.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => {
            const badge = domainSslDisplayBadge({
              sslStatus: item.sslStatus,
              sslExpiresAt: item.sslExpiresAt,
            });
            return (
              <li key={item.id} className="rounded-lg border border-border p-4 text-sm">
                <div className="font-medium">{item.hostname}</div>
                <div className="mt-1 text-muted-foreground">
                  CNAME → <span className="font-mono">{item.cnameTarget}</span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <span data-status={item.status}>{item.status}</span>
                    <span data-ssl-status={badge.dataSslStatus}>{badge.label}</span>
                    {item.sslLastError ? (
                      <p className="text-xs text-destructive">{item.sslLastError}</p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="rounded-md border border-border px-3 py-1 text-xs disabled:opacity-50"
                    disabled={busy}
                    onClick={() => verifyDomain(item.id)}
                  >
                    Verify CNAME
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
