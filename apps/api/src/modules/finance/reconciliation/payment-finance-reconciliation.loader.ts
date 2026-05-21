import type { EntityManager } from "typeorm";
import { In, IsNull, MoreThanOrEqual } from "typeorm";
import { OutboxEventEntity } from "../../../common/outbox/entities/outbox-event.entity";
import { BookingPriceSnapshotEntity } from "../../pricing/entities/booking-price-snapshot.entity";
import { PaymentEntity, PaymentStatus } from "../../payments/entities/payment.entity";
import {
  RegistrationEntity
} from "../../registrations/registration.entity";
import { bookingWalletId } from "../ledger/booking-ledger-authority.service";
import { REGISTRATION_LEADER_PAYMENT_CLEARING_ACCOUNT } from "../ledger/ledger-accounts";
import { AccountBalanceEntity } from "../ledger/entities/account-balance.entity";
import { LedgerJournalLineEntity } from "../ledger/entities/ledger-journal-line.entity";
import { ledgerJournalLineEntityToDomain } from "../ledger/ledger-journal-line.mapper";
import type { LedgerJournalLine } from "../ledger/ledger-journal-line";
import type {
  BookingSnapshotRow,
  InternalPaymentRow,
  ClearingBalanceRow,
  PaymentReconciliationReportInput,
  ProviderCaptureFact,
  RegistrationProjectionRow
} from "./payment-reconciliation-report";

const MAX_PAYMENTS = 5000;
const MAX_OUTBOX_FINANCE = 8000;
const MAX_OUTBOX_PAYMENT_SUCCESS = 3000;

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

/** Minor-units string suitable for {@link InternalPaymentRow.amountMinor} / triad compare. */
export function paymentAmountToMinorString(amount: string): string {
  const t = amount.trim();
  const dot = t.indexOf(".");
  if (dot === -1) {
    return t;
  }
  const frac = t.slice(dot + 1);
  if (/^0+$/.test(frac)) {
    return t.slice(0, dot);
  }
  return t;
}

export function tryParseLedgerJournalLine(
  raw: Record<string, unknown>,
  fallbackTenantId: string
): LedgerJournalLine | null {
  const id = typeof raw.id === "string" ? raw.id.trim() : "";
  const journalId = typeof raw.journalId === "string" ? raw.journalId.trim() : "";
  const tenantId =
    typeof raw.tenantId === "string" && raw.tenantId.trim() !== ""
      ? raw.tenantId.trim()
      : fallbackTenantId;
  const account = typeof raw.account === "string" ? raw.account.trim() : "";
  const side = raw.side === "debit" || raw.side === "credit" ? raw.side : null;
  const amount_minor = typeof raw.amount_minor === "string" ? raw.amount_minor.trim() : "";
  const currency = typeof raw.currency === "string" ? raw.currency.trim() : "";
  const correlationId = typeof raw.correlationId === "string" ? raw.correlationId.trim() : "";
  const idempotencyKey = typeof raw.idempotencyKey === "string" ? raw.idempotencyKey.trim() : "";
  const createdAt = typeof raw.createdAt === "string" ? raw.createdAt.trim() : "";
  if (
    !id ||
    !journalId ||
    !tenantId ||
    !account ||
    !side ||
    !amount_minor ||
    !currency ||
    !correlationId ||
    !idempotencyKey ||
    !createdAt
  ) {
    return null;
  }
  const line: LedgerJournalLine = {
    id,
    journalId,
    tenantId,
    account,
    side,
    amount_minor,
    currency,
    correlationId,
    idempotencyKey,
    createdAt
  };
  if (typeof raw.reversesLineId === "string" && raw.reversesLineId.trim() !== "") {
    (line as { reversesLineId?: string }).reversesLineId = raw.reversesLineId.trim();
  }
  if (isRecord(raw.metadata)) {
    line.metadata = raw.metadata;
  }
  return line;
}

export function ledgerLinesFromFinanceOutboxRows(
  rows: readonly OutboxEventEntity[],
  tenantId: string
): LedgerJournalLine[] {
  const out: LedgerJournalLine[] = [];
  for (const row of rows) {
    if (row.eventType !== "finance.ledger.double_entry_applied") {
      continue;
    }
    const lines = row.payload.lines;
    if (!Array.isArray(lines)) {
      continue;
    }
    for (const item of lines) {
      if (!isRecord(item)) {
        continue;
      }
      const line = tryParseLedgerJournalLine(item, tenantId);
      if (line) {
        out.push(line);
      }
    }
  }
  return out;
}

function latestSnapshotsByBookingId(
  rows: BookingPriceSnapshotEntity[]
): BookingSnapshotRow[] {
  const byBooking = new Map<string, BookingPriceSnapshotEntity>();
  const sorted = [...rows].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  for (const s of sorted) {
    if (!byBooking.has(s.bookingId)) {
      byBooking.set(s.bookingId, s);
    }
  }
  return [...byBooking.values()].map((s) => ({
    bookingId: s.bookingId,
    computedTotalMinor: s.computedTotalMinor,
    currency: s.currency
  }));
}

/**
 * Loads tenant-scoped rows for {@link generatePaymentReconciliationReport}.
 *
 * **PSP path:** `payment.succeeded` outbox rows (webhook / capture pipeline) correlated to `payments`
 * rows for {@link ProviderCaptureFact}. **Ledger path:** `finance.ledger.double_entry_applied` payloads.
 */
export async function loadPaymentReconciliationReportInputForTenant(
  manager: EntityManager,
  tenantId: string,
  options: { lookbackDays: number }
): Promise<PaymentReconciliationReportInput> {
  const tid = tenantId.trim().toLowerCase();
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - Math.max(1, options.lookbackDays));

  const payments = await manager.find(PaymentEntity, {
    where: {
      tenantId: tid,
      deletedAt: IsNull(),
      createdAt: MoreThanOrEqual(since)
    },
    order: { createdAt: "DESC" },
    take: MAX_PAYMENTS
  });

  const registrationIds = [...new Set(payments.map((p) => p.registrationId))];
  const paymentById = new Map(payments.map((p) => [p.id, p]));

  const internalPayments: InternalPaymentRow[] = payments.map((p) => ({
    id: p.id,
    registrationId: p.registrationId,
    amountMinor: paymentAmountToMinorString(p.amount),
    currency: p.currency,
    status: p.status,
    providerPaymentId: p.providerPaymentId
  }));

  const registrations =
    registrationIds.length === 0
      ? []
      : await manager.find(RegistrationEntity, {
          where: { tenantId: tid, id: In(registrationIds) },
          select: {
            id: true,
            paidAmount: true,
            quotedCurrencyCode: true,
            paymentStatus: true
          }
        });

  const registrationRows: RegistrationProjectionRow[] = registrations.map((r) => ({
    bookingId: r.id,
    paidAmountMinor: r.paidAmount !== undefined && r.paidAmount !== null ? String(r.paidAmount) : null,
    quotedCurrencyCode: r.quotedCurrencyCode ?? null,
    paymentStatus: String(r.paymentStatus)
  }));

  const snapshotRows =
    registrationIds.length === 0
      ? []
      : await manager.find(BookingPriceSnapshotEntity, {
          where: { tenantId: tid, bookingId: In(registrationIds) }
        });
  const bookingSnapshots = latestSnapshotsByBookingId(snapshotRows);

  const outboxRows = await manager.find(OutboxEventEntity, {
    where: {
      tenantId: tid,
      eventType: In(["payment.succeeded", "finance.ledger.double_entry_applied"]),
      createdAt: MoreThanOrEqual(since)
    },
    order: { createdAt: "DESC" },
    take: MAX_OUTBOX_FINANCE + MAX_OUTBOX_PAYMENT_SUCCESS
  });

  const financeRows = outboxRows.filter((r) => r.eventType === "finance.ledger.double_entry_applied");
  const succeededRows = outboxRows.filter((r) => r.eventType === "payment.succeeded");

  const persistedLineRows = await manager.find(LedgerJournalLineEntity, {
    where: { tenantId: tid, createdAt: MoreThanOrEqual(since) },
    order: { createdAt: "ASC" },
    take: MAX_OUTBOX_FINANCE
  });
  const ledgerLinesFromDb = persistedLineRows.map(ledgerJournalLineEntityToDomain);
  const ledgerLinesFromOutbox = ledgerLinesFromFinanceOutboxRows(financeRows, tid);
  const ledgerLines =
    ledgerLinesFromDb.length > 0 ? ledgerLinesFromDb : ledgerLinesFromOutbox;

  const registrationById = new Map(registrations.map((r) => [r.id, r]));
  const walletBalanceMinorByBookingId: Record<string, string> = {};
  for (const registrationId of registrationIds) {
    const walletAccount = bookingWalletId(registrationId);
    const reg = registrationById.get(registrationId);
    const paymentForReg = payments.find((p) => p.registrationId === registrationId);
    const currency =
      reg?.quotedCurrencyCode?.trim() || paymentForReg?.currency?.trim() || "UNK";
    const balanceRow = await manager.findOne(AccountBalanceEntity, {
      where: { tenantId: tid, account: walletAccount, currency }
    });
    walletBalanceMinorByBookingId[registrationId] = balanceRow?.balanceMinor ?? "0";
  }

  const providerCapturedPayments: ProviderCaptureFact[] = [];
  const seenProviderIds = new Set<string>();
  for (const ev of succeededRows) {
    const entityId = ev.payload.entityId;
    if (typeof entityId !== "string" || entityId.trim() === "") {
      continue;
    }
    const pay = paymentById.get(entityId.trim());
    if (!pay || pay.status !== PaymentStatus.PAID) {
      continue;
    }
    const pid = pay.providerPaymentId?.trim();
    if (!pid) {
      continue;
    }
    if (seenProviderIds.has(pid)) {
      continue;
    }
    seenProviderIds.add(pid);
    providerCapturedPayments.push({
      providerPaymentId: pid,
      registrationId: pay.registrationId,
      capturedAmountMinor: paymentAmountToMinorString(pay.amount),
      currency: pay.currency
    });
  }

  const clearingBalanceRows = await manager.find(AccountBalanceEntity, {
    where: { tenantId: tid, account: REGISTRATION_LEADER_PAYMENT_CLEARING_ACCOUNT }
  });
  const leaderClearingBalances: ClearingBalanceRow[] = clearingBalanceRows.map((r) => ({
    currency: r.currency,
    balanceMinor: r.balanceMinor
  }));

  return {
    tenantId: tid,
    ledgerLines,
    walletBalanceMinorByBookingId,
    leaderClearingBalances,
    internalPayments,
    providerCapturedPayments,
    bookingSnapshots,
    registrations: registrationRows
  };
}
