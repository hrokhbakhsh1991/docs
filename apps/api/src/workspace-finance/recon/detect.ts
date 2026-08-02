/**
 * Read-only finance recon detectors (admin Prisma). No money mutations.
 */
import { Prisma } from "@prisma/client";

import { getBackgroundAdminClient, BACKGROUND_ADMIN_REASON } from "../../db/background-admin-client";
import { FINANCE_RECON_LOOKBACK_MS } from "../finance-ops-metrics";
import { paymentLedgerCaptureDomainEventId } from "../paid-without-ledger-detection";
import { tourCreatedLedgerDomainEventPrefix } from "../registration-booking-wallet-credit";
import {
  FINANCE_RECON_CODE,
  type FinanceReconFindingDraft,
} from "./codes";

export type FinanceReconDetectOptions = {
  readonly lookbackMs?: number;
  readonly batchSize?: number;
  readonly tenantId?: string;
  readonly staleOutboxMs?: number;
  readonly stuckPendingMs?: number;
};

function lookbackSince(ms: number): Date {
  return new Date(Date.now() - ms);
}

/** Sum debit `amount_minor` from a ledger outbox payload (best-effort). */
export function sumDebitLinesMinor(payload: unknown): bigint | null {
  if (payload === null || typeof payload !== "object") {
    return null;
  }
  const lines = (payload as { lines?: unknown }).lines;
  if (!Array.isArray(lines)) {
    return null;
  }
  let sum = 0n;
  let sawDebit = false;
  for (const line of lines) {
    if (line === null || typeof line !== "object") {
      continue;
    }
    const side = (line as { side?: unknown }).side;
    if (side !== "debit") {
      continue;
    }
    const raw = (line as { amount_minor?: unknown }).amount_minor;
    if (typeof raw !== "string" && typeof raw !== "number") {
      return null;
    }
    try {
      sum += BigInt(raw);
      sawDebit = true;
    } catch {
      return null;
    }
  }
  return sawDebit ? sum : null;
}

/** R1 — Paid without capture outbox. */
export async function detectPaidNoLedger(
  options: FinanceReconDetectOptions = {}
): Promise<readonly FinanceReconFindingDraft[]> {
  const admin = getBackgroundAdminClient(BACKGROUND_ADMIN_REASON.BG_FINANCE_RECON);
  const since = lookbackSince(options.lookbackMs ?? FINANCE_RECON_LOOKBACK_MS);
  const limit = options.batchSize ?? 500;
  const tenantFilter =
    options.tenantId !== undefined
      ? Prisma.sql`AND p.tenant_id = ${options.tenantId}::uuid`
      : Prisma.empty;

  const rows = await admin.$queryRaw<
    Array<{
      id: string;
      tenant_id: string;
      registration_id: string;
      amount: string;
      currency: string;
      paid_at: Date;
    }>
  >(Prisma.sql`
    SELECT p.id, p.tenant_id, p.registration_id, p.amount, p.currency, p.paid_at
    FROM payments p
    WHERE p.status = 'Paid'
      AND p.paid_at IS NOT NULL
      AND p.paid_at > ${since}
      ${tenantFilter}
      AND NOT EXISTS (
        SELECT 1 FROM outbox_events o
        WHERE o.tenant_id = p.tenant_id
          AND o.domain_event_id = ('payment:' || p.id::text || ':ledger-capture-anchor')
          AND o.event_type = 'finance.ledger.double_entry_applied'
      )
    ORDER BY p.paid_at ASC
    LIMIT ${limit}
  `);

  return rows.map((row) => ({
    tenantId: row.tenant_id,
    code: FINANCE_RECON_CODE.paidNoLedger,
    fingerprint: `payment:${row.id}`,
    paymentId: row.id,
    registrationId: row.registration_id,
    details: {
      amount: row.amount,
      currency: row.currency,
      paidAt: row.paid_at.toISOString(),
      expectedDomainEventId: paymentLedgerCaptureDomainEventId(row.id),
    },
  }));
}

/** R1b — Paid + capture exists but debit sum ≠ payment.amount. */
export async function detectPaidAmtMismatch(
  options: FinanceReconDetectOptions = {}
): Promise<readonly FinanceReconFindingDraft[]> {
  const admin = getBackgroundAdminClient(BACKGROUND_ADMIN_REASON.BG_FINANCE_RECON);
  const since = lookbackSince(options.lookbackMs ?? FINANCE_RECON_LOOKBACK_MS);
  const limit = options.batchSize ?? 500;
  const tenantFilter =
    options.tenantId !== undefined
      ? Prisma.sql`AND p.tenant_id = ${options.tenantId}::uuid`
      : Prisma.empty;

  const rows = await admin.$queryRaw<
    Array<{
      id: string;
      tenant_id: string;
      registration_id: string;
      amount: string;
      currency: string;
      payload: unknown;
    }>
  >(Prisma.sql`
    SELECT p.id, p.tenant_id, p.registration_id, p.amount::text AS amount, p.currency, o.payload
    FROM payments p
    INNER JOIN outbox_events o
      ON o.tenant_id = p.tenant_id
     AND o.event_type = 'finance.ledger.double_entry_applied'
     AND o.domain_event_id = ('payment:' || p.id::text || ':ledger-capture-anchor')
    WHERE p.status = 'Paid'
      AND p.paid_at IS NOT NULL
      AND p.paid_at > ${since}
      ${tenantFilter}
    ORDER BY p.paid_at ASC
    LIMIT ${limit}
  `);

  const findings: FinanceReconFindingDraft[] = [];
  for (const row of rows) {
    const debitSum = sumDebitLinesMinor(row.payload);
    if (debitSum === null) {
      findings.push({
        tenantId: row.tenant_id,
        code: FINANCE_RECON_CODE.paidAmtMismatch,
        fingerprint: `amt-parse:${row.id}`,
        paymentId: row.id,
        registrationId: row.registration_id,
        details: {
          reason: "malformed_or_missing_debit_lines",
          paymentAmount: row.amount,
          currency: row.currency,
        },
      });
      continue;
    }
    let paymentAmount: bigint;
    try {
      paymentAmount = BigInt(row.amount);
    } catch {
      continue;
    }
    if (debitSum !== paymentAmount) {
      findings.push({
        tenantId: row.tenant_id,
        code: FINANCE_RECON_CODE.paidAmtMismatch,
        fingerprint: `amt:${row.id}`,
        paymentId: row.id,
        registrationId: row.registration_id,
        details: {
          paymentAmount: row.amount,
          debitSum: debitSum.toString(),
          currency: row.currency,
        },
      });
    }
  }
  return findings;
}

/**
 * R1c — duplicate capture rows for the same domain_event_id
 * (should be impossible under unique; still detect).
 */
export async function detectDupCapture(
  options: FinanceReconDetectOptions = {}
): Promise<readonly FinanceReconFindingDraft[]> {
  const admin = getBackgroundAdminClient(BACKGROUND_ADMIN_REASON.BG_FINANCE_RECON);
  const since = lookbackSince(options.lookbackMs ?? FINANCE_RECON_LOOKBACK_MS);
  const limit = options.batchSize ?? 200;
  const tenantFilter =
    options.tenantId !== undefined
      ? Prisma.sql`AND o.tenant_id = ${options.tenantId}::uuid`
      : Prisma.empty;

  const rows = await admin.$queryRaw<
    Array<{
      tenant_id: string;
      domain_event_id: string;
      cnt: bigint;
      payment_id: string | null;
    }>
  >(Prisma.sql`
    SELECT o.tenant_id, o.domain_event_id, COUNT(*)::bigint AS cnt,
           NULLIF(substring(o.domain_event_id from '^payment:([0-9a-f-]{36}):ledger-capture-anchor$'), '') AS payment_id
    FROM outbox_events o
    WHERE o.event_type = 'finance.ledger.double_entry_applied'
      AND o.domain_event_id LIKE 'payment:%:ledger-capture-anchor'
      AND o.created_at > ${since}
      ${tenantFilter}
    GROUP BY o.tenant_id, o.domain_event_id
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC
    LIMIT ${limit}
  `);

  return rows.map((row) => ({
    tenantId: row.tenant_id,
    code: FINANCE_RECON_CODE.dupCapture,
    fingerprint: `dup:${row.domain_event_id}`,
    paymentId: row.payment_id ?? undefined,
    details: {
      domainEventId: row.domain_event_id,
      count: Number(row.cnt),
    },
  }));
}

/** R2 — prepayment.recorded without sibling ledger domainEventId. */
export async function detectPrepayNoLedger(
  options: FinanceReconDetectOptions = {}
): Promise<readonly FinanceReconFindingDraft[]> {
  const admin = getBackgroundAdminClient(BACKGROUND_ADMIN_REASON.BG_FINANCE_RECON);
  const since = lookbackSince(options.lookbackMs ?? FINANCE_RECON_LOOKBACK_MS);
  const limit = options.batchSize ?? 500;
  const tenantFilter =
    options.tenantId !== undefined
      ? Prisma.sql`AND r.tenant_id = ${options.tenantId}::uuid`
      : Prisma.empty;

  const rows = await admin.$queryRaw<
    Array<{
      id: string;
      tenant_id: string;
      domain_event_id: string;
      registration_id: string | null;
    }>
  >(Prisma.sql`
    SELECT r.id, r.tenant_id, r.domain_event_id,
           (r.payload->>'registrationId') AS registration_id
    FROM outbox_events r
    WHERE r.event_type = 'finance.prepayment.recorded'
      AND r.created_at > ${since}
      AND r.domain_event_id IS NOT NULL
      ${tenantFilter}
      AND NOT EXISTS (
        SELECT 1 FROM outbox_events l
        WHERE l.tenant_id = r.tenant_id
          AND l.event_type = 'finance.ledger.double_entry_applied'
          AND l.domain_event_id = (r.domain_event_id || ':ledger')
      )
    ORDER BY r.created_at ASC
    LIMIT ${limit}
  `);

  return rows.map((row) => ({
    tenantId: row.tenant_id,
    code: FINANCE_RECON_CODE.prepayNoLedger,
    fingerprint: `prepay:${row.domain_event_id}`,
    registrationId: row.registration_id ?? undefined,
    outboxEventId: row.id,
    details: {
      prepaymentDomainEventId: row.domain_event_id,
      expectedLedgerDomainEventId: `${row.domain_event_id}:ledger`,
    },
  }));
}

/** R3 — Paid payment but booking payment_status ≠ paid. */
export async function detectPaidBookingDrift(
  options: FinanceReconDetectOptions = {}
): Promise<readonly FinanceReconFindingDraft[]> {
  const admin = getBackgroundAdminClient(BACKGROUND_ADMIN_REASON.BG_FINANCE_RECON);
  const since = lookbackSince(options.lookbackMs ?? FINANCE_RECON_LOOKBACK_MS);
  const limit = options.batchSize ?? 500;
  const tenantFilter =
    options.tenantId !== undefined
      ? Prisma.sql`AND p.tenant_id = ${options.tenantId}::uuid`
      : Prisma.empty;

  const rows = await admin.$queryRaw<
    Array<{
      id: string;
      tenant_id: string;
      registration_id: string;
      booking_payment_status: string | null;
    }>
  >(Prisma.sql`
    SELECT p.id, p.tenant_id, p.registration_id, b.payment_status AS booking_payment_status
    FROM payments p
    INNER JOIN operator_registrations b
      ON b.id = p.registration_id AND b.tenant_id = p.tenant_id
    WHERE p.status = 'Paid'
      AND p.paid_at IS NOT NULL
      AND p.paid_at > ${since}
      AND b.payment_status IS DISTINCT FROM 'paid'
      ${tenantFilter}
    ORDER BY p.paid_at ASC
    LIMIT ${limit}
  `);

  return rows.map((row) => ({
    tenantId: row.tenant_id,
    code: FINANCE_RECON_CODE.paidBookingDrift,
    fingerprint: `booking-drift:${row.id}`,
    paymentId: row.id,
    registrationId: row.registration_id,
    details: {
      bookingPaymentStatus: row.booking_payment_status,
      expected: "paid",
    },
  }));
}

/** R4 — open prepayment booking sync degraded outbox. */
export async function detectPrepayBookingDegraded(
  options: FinanceReconDetectOptions = {}
): Promise<readonly FinanceReconFindingDraft[]> {
  const admin = getBackgroundAdminClient(BACKGROUND_ADMIN_REASON.BG_FINANCE_RECON);
  const limit = options.batchSize ?? 500;
  const tenantFilter =
    options.tenantId !== undefined
      ? Prisma.sql`AND o.tenant_id = ${options.tenantId}::uuid`
      : Prisma.empty;

  const rows = await admin.$queryRaw<
    Array<{
      id: string;
      tenant_id: string;
      domain_event_id: string | null;
      registration_id: string | null;
    }>
  >(Prisma.sql`
    SELECT o.id, o.tenant_id, o.domain_event_id,
           (o.payload->>'registrationId') AS registration_id
    FROM outbox_events o
    WHERE o.event_type = 'finance.prepayment.booking_sync.degraded'
      AND o.status = 'pending'
      ${tenantFilter}
    ORDER BY o.created_at ASC
    LIMIT ${limit}
  `);

  return rows.map((row) => ({
    tenantId: row.tenant_id,
    code: FINANCE_RECON_CODE.prepayBookingDegraded,
    fingerprint: `degraded:${row.domain_event_id ?? row.id}`,
    registrationId: row.registration_id ?? undefined,
    outboxEventId: row.id,
    details: { domainEventId: row.domain_event_id },
  }));
}

/** R5a — finance.* outbox failed. */
export async function detectOutboxFailed(
  options: FinanceReconDetectOptions = {}
): Promise<readonly FinanceReconFindingDraft[]> {
  const admin = getBackgroundAdminClient(BACKGROUND_ADMIN_REASON.BG_FINANCE_RECON);
  const since = lookbackSince(options.lookbackMs ?? FINANCE_RECON_LOOKBACK_MS);
  const limit = options.batchSize ?? 500;
  const tenantFilter =
    options.tenantId !== undefined
      ? Prisma.sql`AND o.tenant_id = ${options.tenantId}::uuid`
      : Prisma.empty;

  const rows = await admin.$queryRaw<
    Array<{
      id: string;
      tenant_id: string;
      event_type: string;
      domain_event_id: string | null;
    }>
  >(Prisma.sql`
    SELECT o.id, o.tenant_id, o.event_type, o.domain_event_id
    FROM outbox_events o
    WHERE o.status = 'failed'
      AND o.event_type LIKE 'finance.%'
      AND o.created_at > ${since}
      ${tenantFilter}
    ORDER BY o.created_at ASC
    LIMIT ${limit}
  `);

  return rows.map((row) => ({
    tenantId: row.tenant_id,
    code: FINANCE_RECON_CODE.outboxFailed,
    fingerprint: `failed:${row.id}`,
    outboxEventId: row.id,
    details: { eventType: row.event_type, domainEventId: row.domain_event_id },
  }));
}

/** R5b — finance.* pending older than SLO. */
export async function detectOutboxStale(
  options: FinanceReconDetectOptions = {}
): Promise<readonly FinanceReconFindingDraft[]> {
  const admin = getBackgroundAdminClient(BACKGROUND_ADMIN_REASON.BG_FINANCE_RECON);
  const staleMs = options.staleOutboxMs ?? 300_000;
  const cutoff = lookbackSince(staleMs);
  const limit = options.batchSize ?? 500;
  const tenantFilter =
    options.tenantId !== undefined
      ? Prisma.sql`AND o.tenant_id = ${options.tenantId}::uuid`
      : Prisma.empty;

  const rows = await admin.$queryRaw<
    Array<{
      id: string;
      tenant_id: string;
      event_type: string;
      created_at: Date;
    }>
  >(Prisma.sql`
    SELECT o.id, o.tenant_id, o.event_type, o.created_at
    FROM outbox_events o
    WHERE o.status = 'pending'
      AND o.event_type LIKE 'finance.%'
      AND o.created_at < ${cutoff}
      ${tenantFilter}
    ORDER BY o.created_at ASC
    LIMIT ${limit}
  `);

  return rows.map((row) => ({
    tenantId: row.tenant_id,
    code: FINANCE_RECON_CODE.outboxStale,
    fingerprint: `stale:${row.id}`,
    outboxEventId: row.id,
    details: {
      eventType: row.event_type,
      ageSeconds: Math.max(0, (Date.now() - row.created_at.getTime()) / 1000),
      staleOutboxMs: staleMs,
    },
  }));
}

/** R5c — Pending payments older than stuck threshold. */
export async function detectStuckPending(
  options: FinanceReconDetectOptions = {}
): Promise<readonly FinanceReconFindingDraft[]> {
  const admin = getBackgroundAdminClient(BACKGROUND_ADMIN_REASON.BG_FINANCE_RECON);
  const stuckMs = options.stuckPendingMs ?? 24 * 60 * 60 * 1000;
  const cutoff = lookbackSince(stuckMs);
  const limit = options.batchSize ?? 500;
  const tenantFilter =
    options.tenantId !== undefined
      ? Prisma.sql`AND p.tenant_id = ${options.tenantId}::uuid`
      : Prisma.empty;

  const rows = await admin.$queryRaw<
    Array<{
      id: string;
      tenant_id: string;
      registration_id: string;
      created_at: Date;
    }>
  >(Prisma.sql`
    SELECT p.id, p.tenant_id, p.registration_id, p.created_at
    FROM payments p
    WHERE p.status = 'Pending'
      AND p.created_at < ${cutoff}
      ${tenantFilter}
    ORDER BY p.created_at ASC
    LIMIT ${limit}
  `);

  return rows.map((row) => ({
    tenantId: row.tenant_id,
    code: FINANCE_RECON_CODE.stuckPending,
    fingerprint: `stuck:${row.id}`,
    paymentId: row.id,
    registrationId: row.registration_id,
    details: { createdAt: row.created_at.toISOString(), stuckPendingMs: stuckMs },
  }));
}

/** R1d — capture ledger outbox with no matching Paid payment. */
export async function detectLedgerNoPayment(
  options: FinanceReconDetectOptions = {}
): Promise<readonly FinanceReconFindingDraft[]> {
  const admin = getBackgroundAdminClient(BACKGROUND_ADMIN_REASON.BG_FINANCE_RECON);
  const since = lookbackSince(options.lookbackMs ?? FINANCE_RECON_LOOKBACK_MS);
  const limit = options.batchSize ?? 200;
  const tenantFilter =
    options.tenantId !== undefined
      ? Prisma.sql`AND o.tenant_id = ${options.tenantId}::uuid`
      : Prisma.empty;

  const rows = await admin.$queryRaw<
    Array<{
      id: string;
      tenant_id: string;
      domain_event_id: string;
      status: string;
      payment_id: string | null;
    }>
  >(Prisma.sql`
    SELECT o.id, o.tenant_id, o.domain_event_id, o.status,
           NULLIF(substring(o.domain_event_id from '^payment:([0-9a-f-]{36}):ledger-capture-anchor$'), '') AS payment_id
    FROM outbox_events o
    WHERE o.event_type = 'finance.ledger.double_entry_applied'
      AND o.domain_event_id LIKE 'payment:%:ledger-capture-anchor'
      AND o.created_at > ${since}
      ${tenantFilter}
      AND NOT EXISTS (
        SELECT 1 FROM payments p
        WHERE p.tenant_id = o.tenant_id
          AND o.domain_event_id = ('payment:' || p.id::text || ':ledger-capture-anchor')
      )
    ORDER BY o.created_at ASC
    LIMIT ${limit}
  `);

  return rows.map((row) => ({
    tenantId: row.tenant_id,
    code: FINANCE_RECON_CODE.ledgerNoPayment,
    fingerprint: `ledger-orphan:${row.domain_event_id}`,
    paymentId: row.payment_id ?? undefined,
    outboxEventId: row.id,
    details: {
      domainEventId: row.domain_event_id,
      outboxStatus: row.status,
    },
  }));
}

/** R6 — TourCreated ledger ∩ payment capture for same registration (info). */
export async function detectDoubleWallet(
  options: FinanceReconDetectOptions = {}
): Promise<readonly FinanceReconFindingDraft[]> {
  const admin = getBackgroundAdminClient(BACKGROUND_ADMIN_REASON.BG_FINANCE_RECON);
  const since = lookbackSince(options.lookbackMs ?? FINANCE_RECON_LOOKBACK_MS);
  const limit = options.batchSize ?? 200;
  const tenantFilter =
    options.tenantId !== undefined
      ? Prisma.sql`AND p.tenant_id = ${options.tenantId}::uuid`
      : Prisma.empty;

  const rows = await admin.$queryRaw<
    Array<{
      tenant_id: string;
      registration_id: string;
      payment_id: string;
      capture_domain_event_id: string;
    }>
  >(Prisma.sql`
    SELECT p.tenant_id, p.registration_id, p.id AS payment_id,
           ('payment:' || p.id::text || ':ledger-capture-anchor') AS capture_domain_event_id
    FROM payments p
    INNER JOIN outbox_events c
      ON c.tenant_id = p.tenant_id
     AND c.event_type = 'finance.ledger.double_entry_applied'
     AND c.domain_event_id = ('payment:' || p.id::text || ':ledger-capture-anchor')
    WHERE p.status = 'Paid'
      AND p.paid_at IS NOT NULL
      AND p.paid_at > ${since}
      ${tenantFilter}
      AND EXISTS (
        SELECT 1 FROM outbox_events t
        WHERE t.tenant_id = p.tenant_id
          AND t.event_type = 'finance.ledger.double_entry_applied'
          AND t.domain_event_id LIKE ('finance.ledger:' || p.registration_id::text || ':tour-created:%')
      )
    ORDER BY p.paid_at ASC
    LIMIT ${limit}
  `);

  return rows.map((row) => ({
    tenantId: row.tenant_id,
    code: FINANCE_RECON_CODE.doubleWallet,
    fingerprint: `double-wallet:${row.registration_id}`,
    paymentId: row.payment_id,
    registrationId: row.registration_id,
    details: {
      captureDomainEventId: row.capture_domain_event_id,
      tourCreatedPrefix: tourCreatedLedgerDomainEventPrefix(row.registration_id),
    },
  }));
}
