"use client";

import { useCallback, useEffect, useState } from "react";

import type { OperatorSessionContext } from "@/admin/require-operator-session";
import { PageHeader } from "@/admin/patterns/page-header";
import { canMutateTickets } from "@/features/tickets/operator-tickets-types";

type ReportSummary = {
  readonly ticketCount: number;
  readonly statusDistribution: Readonly<Record<string, number>>;
  readonly avgFirstResponseSeconds: number | null;
  readonly avgResolutionSeconds: number | null;
  readonly slaBreachCount: number;
};

type Props = {
  readonly session: OperatorSessionContext;
};

export function TicketingReportsClient({ session }: Props) {
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadSummary = useCallback(async (): Promise<void> => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 10_000);
    setLoading(true);
    setError(false);
    setSummary(null);
    try {
      const res = await fetch("/api/ticket-reports/summary", {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new Error(`TICKET_REPORTS_HTTP_${res.status}`);
      }
      const body = (await res.json()) as { summary?: ReportSummary };
      if (body.summary === undefined) {
        throw new Error("TICKET_REPORTS_RESPONSE_INVALID");
      }
      setSummary(body.summary);
    } catch {
      setError(true);
    } finally {
      window.clearTimeout(timeoutId);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  return (
    <div className="space-y-6" data-ticketing-reports>
      <PageHeader title="Ticketing reports" description="Tenant-scoped ticket analytics" />
      {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
      {error ? (
        <div className="space-y-3" role="alert">
          <p className="text-sm text-destructive">
            Ticketing report could not be loaded. Please try again.
          </p>
          <button
            type="button"
            className="rounded-md border px-3 py-2 text-sm"
            onClick={() => void loadSummary()}
          >
            Try again
          </button>
        </div>
      ) : null}
      {!loading && !error && summary !== null ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Tickets</p>
            <p className="text-2xl font-semibold" data-testid="ticketing-report-count">
              {summary.ticketCount}
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">SLA breaches</p>
            <p className="text-2xl font-semibold">{summary.slaBreachCount}</p>
          </div>
          <div className="rounded-lg border p-4 md:col-span-2">
            <p className="mb-2 text-sm font-medium">Status distribution</p>
            <pre className="overflow-auto text-xs">
              {JSON.stringify(summary.statusDistribution, null, 2)}
            </pre>
          </div>
        </div>
      ) : null}
      {canMutateTickets(session.role) ? (
        <a className="text-sm underline" href="/api/ticket-reports/export?format=json&limit=100">
          Export JSON sample
        </a>
      ) : null}
    </div>
  );
}
