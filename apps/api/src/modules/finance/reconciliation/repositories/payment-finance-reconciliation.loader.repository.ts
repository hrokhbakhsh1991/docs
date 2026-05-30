import type { EntityManager } from "typeorm";
import { In, IsNull, MoreThanOrEqual } from "typeorm";
import { OutboxEventEntity } from "../../../../common/outbox/entities/outbox-event.entity";
import type { ReconciliationRegistrationReadPort } from "../../../../common/ports/reconciliation-registration-read.port";
import { BookingPriceSnapshotEntity } from "../../../pricing/entities/booking-price-snapshot.entity";
import { PaymentEntity, PaymentStatus } from "../../../payments/entities/payment.entity";
import { bookingWalletId } from "../../ledger/booking-ledger-authority.service";
import { LEDGER_ACCOUNTS } from "../../ledger/ledger-accounts";
import { AccountBalanceEntity } from "../../ledger/entities/account-balance.entity";
import { LedgerJournalLineEntity } from "../../ledger/entities/ledger-journal-line.entity";
import { ledgerJournalLineEntityToDomain } from "../../ledger/repositories/ledger-journal-line.mapper";
import type {
  BookingSnapshotRow,
  ClearingBalanceRow,
  InternalPaymentRow,
  PaymentReconciliationReportInput,
  ProviderCaptureFact,
  RegistrationProjectionRow,
} from "../payment-reconciliation-report";
import {
  ledgerLinesFromFinanceOutboxRows,
  paymentAmountToMinorString,
} from "../payment-reconciliation-parse";

const MAX_PAYMENTS = 5000;
const MAX_OUTBOX_FINANCE = 8000;
const MAX_OUTBOX_PAYMENT_SUCCESS = 3000;

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
    currency: s.currency,
  }));
}

export async function loadPaymentReconciliationReportInputForTenant(
  manager: EntityManager,
  tenantId: string,
  options: { lookbackDays: number },
  registrationRead: ReconciliationRegistrationReadPort
): Promise<PaymentReconciliationReportInput> {
  const tid = tenantId.trim().toLowerCase();
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - Math.max(1, options.lookbackDays));

  const payments = await manager.find(PaymentEntity, {
    where: {
      tenantId: tid,
      deletedAt: IsNull(),
      createdAt: MoreThanOrEqual(since),
    },
    order: { createdAt: "DESC" },
    take: MAX_PAYMENTS,
  });

  const registrationIds = [...new Set(payments.map((p) => p.registrationId))];
  const paymentById = new Map(payments.map((p) => [p.id, p]));

  const internalPayments: InternalPaymentRow[] = payments.map((p) => ({
    id: p.id,
    registrationId: p.registrationId,
    amountMinor: paymentAmountToMinorString(p.amount),
    currency: p.currency,
    status: p.status,
    providerPaymentId: p.providerPaymentId,
  }));

  const registrationRows: RegistrationProjectionRow[] =
    registrationIds.length === 0
      ? []
      : await registrationRead.loadRegistrationProjections(manager, tid, registrationIds);

  const snapshotRows =
    registrationIds.length === 0
      ? []
      : await manager.find(BookingPriceSnapshotEntity, {
          where: { tenantId: tid, bookingId: In(registrationIds) },
        });
  const bookingSnapshots = latestSnapshotsByBookingId(snapshotRows);

  const outboxRows = await manager.find(OutboxEventEntity, {
    where: {
      tenantId: tid,
      eventType: In(["payment.succeeded", "finance.ledger.double_entry_applied"]),
      createdAt: MoreThanOrEqual(since),
    },
    order: { createdAt: "DESC" },
    take: MAX_OUTBOX_FINANCE + MAX_OUTBOX_PAYMENT_SUCCESS,
  });

  const financeRows = outboxRows.filter((r) => r.eventType === "finance.ledger.double_entry_applied");
  const succeededRows = outboxRows.filter((r) => r.eventType === "payment.succeeded");

  const persistedLineRows = await manager.find(LedgerJournalLineEntity, {
    where: { tenantId: tid, createdAt: MoreThanOrEqual(since) },
    order: { createdAt: "ASC" },
    take: MAX_OUTBOX_FINANCE,
  });
  const ledgerLinesFromDb = persistedLineRows.map(ledgerJournalLineEntityToDomain);
  const ledgerLinesFromOutbox = ledgerLinesFromFinanceOutboxRows(financeRows, tid);
  const ledgerLines = ledgerLinesFromDb.length > 0 ? ledgerLinesFromDb : ledgerLinesFromOutbox;

  const registrationById = new Map(registrationRows.map((r) => [r.bookingId, r]));
  const walletBalanceMinorByBookingId: Record<string, string> = {};
  for (const registrationId of registrationIds) {
    const walletAccount = bookingWalletId(registrationId);
    const reg = registrationById.get(registrationId);
    const paymentForReg = payments.find((p) => p.registrationId === registrationId);
    const currency =
      reg?.quotedCurrencyCode?.trim() || paymentForReg?.currency?.trim() || "UNK";
    const balanceRow = await manager.findOne(AccountBalanceEntity, {
      where: { tenantId: tid, account: walletAccount, currency },
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
      currency: pay.currency,
    });
  }

  const clearingBalanceRows = await manager.find(AccountBalanceEntity, {
    where: { tenantId: tid, account: LEDGER_ACCOUNTS.REGISTRATION_LEADER_PAYMENT_CLEARING },
  });
  const leaderClearingBalances: ClearingBalanceRow[] = clearingBalanceRows.map((r) => ({
    currency: r.currency,
    balanceMinor: r.balanceMinor,
  }));

  return {
    tenantId: tid,
    ledgerLines,
    walletBalanceMinorByBookingId,
    leaderClearingBalances,
    internalPayments,
    providerCapturedPayments,
    bookingSnapshots,
    registrations: registrationRows,
  };
}
