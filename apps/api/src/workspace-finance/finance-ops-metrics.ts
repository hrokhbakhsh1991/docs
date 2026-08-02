/**
 * Phase 3.7 — finance ops gauges refreshed on metrics scrape.
 * Boundaries: admin Prisma counts only; no money mutation.
 */

import { Prisma } from "@prisma/client";

import { getBackgroundAdminClient, BACKGROUND_ADMIN_REASON } from "../db/background-admin-client";
import { metricsRegistry } from "../observability/metrics";

/** Must match `FINANCE_METRIC` in `@app-tour/finance-core` (guarded by deploy-finance-ops-alerts). */
const FINANCE_OUTBOX_AGE = "finance_outbox_oldest_pending_age_seconds";
const FINANCE_RECON_MISMATCH = "finance_reconciliation_mismatch";
const FINANCE_STUCK_PAYMENTS = "finance_stuck_payments";

/** Pending payments older than this are "stuck" for ops. */
export const FINANCE_STUCK_PAYMENT_AGE_MS = 24 * 60 * 60 * 1000;

/** Lookback for Paid-without-ledger scan (1M-scale safety). */
export const FINANCE_RECON_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;

let financeOutboxOldestPendingAgeSeconds = 0;
let financeReconciliationMismatch = 0;
let financeStuckPayments = 0;

export function readFinanceOutboxOldestPendingAgeSeconds(): number {
  return financeOutboxOldestPendingAgeSeconds;
}

export function readFinanceReconciliationMismatch(): number {
  return financeReconciliationMismatch;
}

export function readFinanceStuckPayments(): number {
  return financeStuckPayments;
}

export function resetFinanceOpsGaugesForTests(): void {
  financeOutboxOldestPendingAgeSeconds = 0;
  financeReconciliationMismatch = 0;
  financeStuckPayments = 0;
}

async function refreshFinanceOutboxAge(): Promise<void> {
  if (!process.env.DATABASE_URL_ADMIN?.trim()) {
    return;
  }
  try {
    const admin = getBackgroundAdminClient(BACKGROUND_ADMIN_REASON.BG_FINANCE_RECON);
    const row = await admin.outboxEvent.findFirst({
      where: {
        status: "pending",
        OR: [
          { eventType: "finance.ledger.double_entry_applied" },
          { eventType: { startsWith: "finance.prepayment." } },
        ],
      },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    });
    financeOutboxOldestPendingAgeSeconds =
      row === null ? 0 : Math.max(0, (Date.now() - row.createdAt.getTime()) / 1000);
  } catch {
    // Keep last gauge on transient DB errors.
  }
}

async function refreshStuckPayments(): Promise<void> {
  if (!process.env.DATABASE_URL_ADMIN?.trim()) {
    return;
  }
  try {
    const admin = getBackgroundAdminClient(BACKGROUND_ADMIN_REASON.BG_FINANCE_RECON);
    const cutoff = new Date(Date.now() - FINANCE_STUCK_PAYMENT_AGE_MS);
    financeStuckPayments = await admin.payment.count({
      where: { status: "Pending", createdAt: { lt: cutoff } },
    });
  } catch {
    // Keep last gauge.
  }
}

/**
 * Count recent Paid payments missing stable capture domainEventId outbox row.
 * Windowed to avoid full-table scans at 1M scale on every scrape.
 * Formula: {@link paymentLedgerCaptureDomainEventId} (must stay stable).
 */
async function refreshReconciliationMismatch(): Promise<void> {
  if (!process.env.DATABASE_URL_ADMIN?.trim()) {
    return;
  }
  try {
    const admin = getBackgroundAdminClient(BACKGROUND_ADMIN_REASON.BG_FINANCE_RECON);
    const since = new Date(Date.now() - FINANCE_RECON_LOOKBACK_MS);
    const rows = await admin.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
      SELECT COUNT(*)::bigint AS count
      FROM payments p
      WHERE p.status = 'Paid'
        AND p.paid_at IS NOT NULL
        AND p.paid_at > ${since}
        AND NOT EXISTS (
          SELECT 1
          FROM outbox_events o
          WHERE o.tenant_id = p.tenant_id
            AND o.domain_event_id = ('payment:' || p.id::text || ':ledger-capture-anchor')
            AND o.event_type = 'finance.ledger.double_entry_applied'
        )
    `);
    financeReconciliationMismatch = Number(rows[0]?.count ?? 0n);
  } catch {
    // Keep last gauge.
  }
}

/** Refresh finance ops gauges + mirror into metricsRegistry for Prometheus. */
export async function refreshFinanceOpsGaugesFromDb(): Promise<void> {
  await Promise.all([
    refreshFinanceOutboxAge(),
    refreshStuckPayments(),
    refreshReconciliationMismatch(),
  ]);
  metricsRegistry.observe(FINANCE_OUTBOX_AGE, financeOutboxOldestPendingAgeSeconds);
  metricsRegistry.observe(FINANCE_RECON_MISMATCH, financeReconciliationMismatch);
  metricsRegistry.observe(FINANCE_STUCK_PAYMENTS, financeStuckPayments);
}
