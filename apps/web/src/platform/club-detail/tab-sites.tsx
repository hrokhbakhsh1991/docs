"use client";

import { useCallback, useState } from "react";

import { fetchPlatformApi } from "../platform-api-client";

export type TabSitesProps = {
  readonly tenantId: string;
  readonly sites: {
    readonly marketing: string;
    readonly portal: string;
    readonly admin: string;
  };
  readonly siteSurfaces: {
    readonly admin: boolean;
    readonly marketing: boolean;
    readonly portal: boolean;
  };
};

type SiteHealthRow = {
  readonly url: string;
  readonly ok: boolean;
  readonly status: number | null;
};

type SurfaceKey = "admin" | "marketing" | "portal";

const SURFACE_ROWS: readonly SurfaceKey[] = ["admin", "marketing", "portal"];

function surfaceLabel(key: SurfaceKey): string {
  return key.charAt(0).toUpperCase() + key.slice(1);
}

export function TabSites({ tenantId, sites, siteSurfaces }: TabSitesProps) {
  const [checking, setChecking] = useState(false);
  const [results, setResults] = useState<{
    marketing: SiteHealthRow;
    portal: SiteHealthRow;
    admin: SiteHealthRow;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkHealth = useCallback(async () => {
    setChecking(true);
    setError(null);
    try {
      const response = await fetchPlatformApi(`/tenants/${tenantId}/sites/check`);
      const body = (await response.json().catch(() => ({}))) as {
        results?: {
          marketing: SiteHealthRow;
          portal: SiteHealthRow;
          admin: SiteHealthRow;
        };
      };
      if (!response.ok || !body.results) {
        setError("Health check failed");
        return;
      }
      setResults(body.results);
    } catch {
      setError("Health check failed");
    } finally {
      setChecking(false);
    }
  }, [tenantId]);

  return (
    <div className="space-y-4" data-tab="sites" data-platform-club-sites>
      <dl className="space-y-3 rounded-lg border border-border p-4 text-sm">
        {SURFACE_ROWS.map((key) => {
          const enabled = siteSurfaces[key];
          return (
            <div key={key} data-platform-surface={key}>
              <dt className="flex items-center justify-between gap-3 font-medium">
                <span>{surfaceLabel(key)}</span>
                <span
                  data-platform-surface-badge={enabled ? "enabled" : "disabled"}
                  className={enabled ? "text-emerald-700" : "text-muted-foreground"}
                >
                  {enabled ? "enabled" : "disabled"}
                </span>
              </dt>
              <dd className="break-all text-muted-foreground">{sites[key]}</dd>
            </div>
          );
        })}
      </dl>
      <button
        type="button"
        data-testid="sites-check-health"
        className="inline-flex h-9 items-center rounded-md border border-border px-4 text-sm disabled:opacity-50"
        disabled={checking}
        onClick={checkHealth}
      >
        {checking ? "Checking…" : "Check health"}
      </button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {results ? (
        <ul className="space-y-2 text-sm" data-testid="sites-health-results">
          {(["marketing", "portal", "admin"] as const).map((key) => (
            <li
              key={key}
              className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
            >
              <span className="capitalize">{key}</span>
              <span className={results[key].ok ? "text-emerald-700" : "text-destructive"}>
                {results[key].ok ? "ok" : "down"} ({results[key].status ?? "n/a"})
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
