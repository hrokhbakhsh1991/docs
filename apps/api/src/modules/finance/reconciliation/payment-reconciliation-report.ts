import { randomUUID } from "node:crypto";
import {
  findClearingZeroSumViolationsFromBalances,
  findClearingZeroSumViolationsFromLines
} from "../ledger/clearing-account-zero-sum";
import { assertLedgerLinesFinanceTenantScope, normalizeFinanceTenantId } from "../ledger/ledger-tenant-scope";
import type { LedgerJournalLine } from "../ledger/ledger-journal-line";
import { PaymentStatus } from "../../payments/entities/payment.entity";
import { detectPaymentMismatch } from "./detect-payment-mismatch";
import type { ReconciliationMismatch } from "./reconciliation-mismatch";

/** Row shape loaded outside finance (e.g. payments module / job) — no ORM coupling. */
export type InternalPaymentRow = {
  id: string;
  registrationId: string;
  /** Minor units, decimal string (matches `payments.amount`). */
  amountMinor: string;
  currency: string;
  status: PaymentStatus;
  providerPaymentId: string | null;
};

/** PSP / gateway truth for captured funds (settlement file or API poll). */
export type ProviderCaptureFact = {
  providerPaymentId: string;
  registrationId: string;
  capturedAmountMinor: string;
  currency: string;
};

export type BookingSnapshotRow = {
  bookingId: string;
  computedTotalMinor: string;
  currency: string;
};

export type RegistrationProjectionRow = {
  bookingId: string;
  paidAmountMinor?: string | null;
  quotedCurrencyCode?: string | null;
  paymentStatus: string;
};

export const PaymentReconciliationFindingKind = {
  AMOUNT_TRIAD_MISMATCH: "amount_triad_mismatch",
  DUPLICATE_PAID_INTERNAL_PAYMENT: "duplicate_paid_internal_payment",
  DUPLICATE_PROVIDER_PAYMENT_ID_INTERNAL: "duplicate_provider_payment_id_internal",
  DUPLICATE_PROVIDER_PAYMENT_ID_IN_FEED: "duplicate_provider_payment_id_in_feed",
  MISSING_PROVIDER_CAPTURE: "missing_provider_capture",
  MISSING_INTERNAL_SETTLEMENT: "missing_internal_settlement",
  PAID_WITHOUT_PROVIDER_REFERENCE: "paid_without_provider_reference",
  LEDGER_VS_REGISTRATION_PAID_MISMATCH: "ledger_vs_registration_paid_mismatch",
  MISSING_BOOKING_PRICE_SNAPSHOT: "missing_booking_price_snapshot",
  MIXED_PROVIDER_CURRENCY_FOR_BOOKING: "mixed_provider_currency_for_booking",
  INVALID_PROVIDER_AMOUNT_IN_FEED: "invalid_provider_amount_in_feed",
  CLEARING_ACCOUNT_NET_NONZERO: "clearing_account_net_nonzero"
} as const;

export type PaymentReconciliationFindingKind =
  (typeof PaymentReconciliationFindingKind)[keyof typeof PaymentReconciliationFindingKind];

export type PaymentReconciliationFinding = {
  readonly id: string;
  readonly kind: PaymentReconciliationFindingKind;
  readonly bookingId: string;
  readonly severity: "critical" | "warning" | "info";
  readonly message: string;
  readonly data: Record<string, unknown>;
  /** Present when {@link PaymentReconciliationFindingKind.AMOUNT_TRIAD_MISMATCH} materialized via {@link detectPaymentMismatch}. */
  readonly triadMismatch?: ReconciliationMismatch;
};

export type PaymentReconciliationReportSummary = {
  readonly bookingIdsExamined: number;
  readonly findingCount: number;
  readonly byKind: Readonly<Record<string, number>>;
  readonly criticalCount: number;
  readonly warningCount: number;
  readonly infoCount: number;
};

export type PaymentReconciliationReport = {
  readonly id: string;
  readonly tenantId: string;
  readonly generatedAt: string;
  readonly summary: PaymentReconciliationReportSummary;
  readonly findings: readonly PaymentReconciliationFinding[];
};

export type ClearingBalanceRow = {
  currency: string;
  balanceMinor: string;
};

export type PaymentReconciliationReportInput = {
  /** Workspace scope — all `ledgerLines` must carry this tenant_id (normalized). */
  tenantId: string;
  ledgerLines: readonly LedgerJournalLine[];
  /** Authoritative `account_balances` snapshot per booking id (`booking:{id}` wallet). */
  walletBalanceMinorByBookingId: Readonly<Record<string, string>>;
  /** Optional persisted clearing-account buckets for zero-sum validation (Section 4.3). */
  leaderClearingBalances?: readonly ClearingBalanceRow[];
  internalPayments: readonly InternalPaymentRow[];
  providerCapturedPayments: readonly ProviderCaptureFact[];
  bookingSnapshots: readonly BookingSnapshotRow[];
  registrations: readonly RegistrationProjectionRow[];
  reportId?: string;
};

const BOOKING_ACCOUNT_PREFIX = "booking:";

function parseBookingIdFromLedgerAccount(account: string): string | null {
  if (!account.startsWith(BOOKING_ACCOUNT_PREFIX)) {
    return null;
  }
  const id = account.slice(BOOKING_ACCOUNT_PREFIX.length).trim();
  return id.length > 0 ? id : null;
}

function collectBookingIds(input: PaymentReconciliationReportInput): Set<string> {
  const ids = new Set<string>();
  for (const p of input.internalPayments) {
    if (p.registrationId) ids.add(p.registrationId);
  }
  for (const s of input.bookingSnapshots) {
    ids.add(s.bookingId);
  }
  for (const r of input.registrations) {
    ids.add(r.bookingId);
  }
  for (const f of input.providerCapturedPayments) {
    ids.add(f.registrationId);
  }
  for (const line of input.ledgerLines) {
    const bid = parseBookingIdFromLedgerAccount(line.account);
    if (bid) ids.add(bid);
  }
  return ids;
}

function tryParseMinor(raw: string): bigint | undefined {
  const s = raw.trim();
  if (s === "") return 0n;
  try {
    return BigInt(s);
  } catch {
    return undefined;
  }
}

function findInternalPaidByProviderId(
  payments: readonly InternalPaymentRow[],
  providerPaymentId: string
): InternalPaymentRow | undefined {
  const want = providerPaymentId.trim();
  return payments.find(
    (p) => (p.providerPaymentId?.trim() ?? "") === want && p.status === PaymentStatus.PAID
  );
}

function sumProviderCapturesForBooking(
  facts: readonly ProviderCaptureFact[],
  bookingId: string
): { sumMinor: string; currency: string | null; error: string | null } {
  let total = 0n;
  let cur: string | null = null;
  for (const f of facts) {
    if (f.registrationId !== bookingId) continue;
    const c = f.currency.trim().toUpperCase();
    if (c === "") {
      return { sumMinor: "0", currency: null, error: "empty_currency" };
    }
    if (cur === null) cur = c;
    else if (cur !== c) {
      return { sumMinor: "0", currency: null, error: "mixed_currency" };
    }
    const n = tryParseMinor(f.capturedAmountMinor);
    if (n === undefined) {
      return { sumMinor: "0", currency: cur, error: "invalid_amount" };
    }
    total += n;
  }
  return { sumMinor: total.toString(), currency: cur, error: null };
}

function finding(
  kind: PaymentReconciliationFindingKind,
  bookingId: string,
  severity: PaymentReconciliationFinding["severity"],
  message: string,
  data: Record<string, unknown>,
  triadMismatch?: ReconciliationMismatch
): PaymentReconciliationFinding {
  return {
    id: randomUUID(),
    kind,
    bookingId,
    severity,
    message,
    data,
    ...(triadMismatch !== undefined ? { triadMismatch } : {})
  };
}

function summarize(findings: readonly PaymentReconciliationFinding[]): PaymentReconciliationReportSummary {
  const byKind: Record<string, number> = {};
  let critical = 0;
  let warning = 0;
  let info = 0;
  for (const f of findings) {
    byKind[f.kind] = (byKind[f.kind] ?? 0) + 1;
    if (f.severity === "critical") critical += 1;
    else if (f.severity === "warning") warning += 1;
    else info += 1;
  }
  return {
    bookingIdsExamined: 0,
    findingCount: findings.length,
    byKind,
    criticalCount: critical,
    warningCount: warning,
    infoCount: info
  };
}

/**
 * Correlates **append-only ledger lines** (booking wallet), **`payments` rows**, **provider capture facts**,
 * **immutable booking price snapshots**, and **registration `paid_amount` / payment_status` projections**.
 *
 * Callers load rows outside `modules/finance` and pass plain shapes here (finance boundary isolation).
 */
export function generatePaymentReconciliationReport(
  input: PaymentReconciliationReportInput
): PaymentReconciliationReport {
  const tenantId = normalizeFinanceTenantId(input.tenantId);
  assertLedgerLinesFinanceTenantScope(tenantId, input.ledgerLines);
  const generatedAt = new Date().toISOString();
  const findings: PaymentReconciliationFinding[] = [];

  for (const v of findClearingZeroSumViolationsFromLines(tenantId, input.ledgerLines)) {
    findings.push(
      finding(
        PaymentReconciliationFindingKind.CLEARING_ACCOUNT_NET_NONZERO,
        tenantId,
        "critical",
        `Leader clearing account net non-zero for currency ${v.currency} (${v.source})`,
        { currency: v.currency, netMinor: v.netMinor, source: v.source }
      )
    );
  }
  if (input.leaderClearingBalances && input.leaderClearingBalances.length > 0) {
    for (const v of findClearingZeroSumViolationsFromBalances(input.leaderClearingBalances)) {
      findings.push(
        finding(
          PaymentReconciliationFindingKind.CLEARING_ACCOUNT_NET_NONZERO,
          tenantId,
          "critical",
          `Leader clearing account balance non-zero for currency ${v.currency} (${v.source})`,
          { currency: v.currency, netMinor: v.netMinor, source: v.source }
        )
      );
    }
  }

  const bookingIds = collectBookingIds(input);
  const internalByProviderId = new Map<string, InternalPaymentRow[]>();
  for (const p of input.internalPayments) {
    const pid = p.providerPaymentId?.trim();
    if (!pid) continue;
    const list = internalByProviderId.get(pid) ?? [];
    list.push(p);
    internalByProviderId.set(pid, list);
  }

  const seenProviderFeedIds = new Set<string>();
  for (const f of input.providerCapturedPayments) {
    const pid = f.providerPaymentId.trim();
    if (seenProviderFeedIds.has(pid)) {
      findings.push(
        finding(
          PaymentReconciliationFindingKind.DUPLICATE_PROVIDER_PAYMENT_ID_IN_FEED,
          f.registrationId,
          "critical",
          `Provider feed lists providerPaymentId more than once: ${pid}`,
          { providerPaymentId: pid }
        )
      );
    } else {
      seenProviderFeedIds.add(pid);
    }
  }

  for (const [pid, rows] of internalByProviderId) {
    if (rows.length > 1) {
      findings.push(
        finding(
          PaymentReconciliationFindingKind.DUPLICATE_PROVIDER_PAYMENT_ID_INTERNAL,
          rows[0]!.registrationId,
          "critical",
          `Multiple internal payment rows share providerPaymentId ${pid}`,
          { providerPaymentId: pid, paymentIds: rows.map((r) => r.id) }
        )
      );
    }
  }

  const paidByRegistration = new Map<string, InternalPaymentRow[]>();
  for (const p of input.internalPayments) {
    if (p.status !== PaymentStatus.PAID) continue;
    const list = paidByRegistration.get(p.registrationId) ?? [];
    list.push(p);
    paidByRegistration.set(p.registrationId, list);
  }
  for (const [regId, paid] of paidByRegistration) {
    if (paid.length > 1) {
      findings.push(
        finding(
          PaymentReconciliationFindingKind.DUPLICATE_PAID_INTERNAL_PAYMENT,
          regId,
          "critical",
          `More than one internal payment in Paid status for booking ${regId}`,
          { paymentIds: paid.map((x) => x.id) }
        )
      );
    }
  }

  for (const p of input.internalPayments) {
    if (p.status !== PaymentStatus.PAID) continue;
    const ref = p.providerPaymentId?.trim();
    if (!ref) {
      findings.push(
        finding(
          PaymentReconciliationFindingKind.PAID_WITHOUT_PROVIDER_REFERENCE,
          p.registrationId,
          "warning",
          `Internal payment ${p.id} is Paid but has no providerPaymentId (cannot tie to PSP)`,
          { paymentId: p.id }
        )
      );
      continue;
    }
    const inFeed = input.providerCapturedPayments.some((x) => x.providerPaymentId.trim() === ref);
    if (!inFeed) {
      findings.push(
        finding(
          PaymentReconciliationFindingKind.MISSING_PROVIDER_CAPTURE,
          p.registrationId,
          "critical",
          `Internal Paid payment ${p.id} has providerPaymentId ${ref} but no matching provider capture fact`,
          { paymentId: p.id, providerPaymentId: ref }
        )
      );
    }
  }

  const uniqueProviderFacts = new Map<string, ProviderCaptureFact>();
  for (const f of input.providerCapturedPayments) {
    uniqueProviderFacts.set(f.providerPaymentId.trim(), f);
  }
  for (const f of uniqueProviderFacts.values()) {
    const pid = f.providerPaymentId.trim();
    const paid = findInternalPaidByProviderId(input.internalPayments, pid);
    if (!paid) {
      findings.push(
        finding(
          PaymentReconciliationFindingKind.MISSING_INTERNAL_SETTLEMENT,
          f.registrationId,
          "critical",
          `Provider reports capture for ${pid} but there is no matching internal Paid payment`,
          { providerPaymentId: pid, registrationId: f.registrationId }
        )
      );
    }
  }

  const snapshotByBooking = new Map(input.bookingSnapshots.map((s) => [s.bookingId, s]));
  const registrationByBooking = new Map(input.registrations.map((r) => [r.bookingId, r]));

  for (const bookingId of bookingIds) {
    const ledgerMinor = (input.walletBalanceMinorByBookingId[bookingId] ?? "0").trim() || "0";
    const reg = registrationByBooking.get(bookingId);
    if (reg) {
      const paidProj = reg.paidAmountMinor?.trim() ?? "";
      const ledgerN = tryParseMinor(ledgerMinor);
      const regN = paidProj === "" ? 0n : tryParseMinor(paidProj);
      if (ledgerN !== undefined && regN !== undefined && ledgerN !== regN) {
        findings.push(
          finding(
            PaymentReconciliationFindingKind.LEDGER_VS_REGISTRATION_PAID_MISMATCH,
            bookingId,
            "warning",
            `Ledger booking wallet balance ${ledgerMinor} does not match registration paid_amount projection ${paidProj || "0"}`,
            { ledger_minor: ledgerMinor, registration_paid_minor: paidProj || "0" }
          )
        );
      }
    }

    const snapshot = snapshotByBooking.get(bookingId);
    const paidRows = paidByRegistration.get(bookingId) ?? [];
    const pspAgg = sumProviderCapturesForBooking(input.providerCapturedPayments, bookingId);

    if (pspAgg.error === "mixed_currency") {
      findings.push(
        finding(
          PaymentReconciliationFindingKind.MIXED_PROVIDER_CURRENCY_FOR_BOOKING,
          bookingId,
          "critical",
          "Provider capture facts use multiple currencies for the same booking",
          {}
        )
      );
      continue;
    }
    if (pspAgg.error === "empty_currency") {
      findings.push(
        finding(
          PaymentReconciliationFindingKind.INVALID_PROVIDER_AMOUNT_IN_FEED,
          bookingId,
          "warning",
          "Provider capture fact has empty currency for this booking",
          {}
        )
      );
      continue;
    }

    const hasMoneySignal =
      paidRows.length > 0 ||
      (tryParseMinor(ledgerMinor) ?? 0n) !== 0n ||
      (tryParseMinor(pspAgg.sumMinor) ?? 0n) !== 0n;

    if (!snapshot && hasMoneySignal) {
      findings.push(
        finding(
          PaymentReconciliationFindingKind.MISSING_BOOKING_PRICE_SNAPSHOT,
          bookingId,
          "info",
          "Money signal present (ledger / paid / provider) but no immutable booking price snapshot row supplied",
          {}
        )
      );
    }

    if (snapshot) {
      const curSnap = snapshot.currency.trim().toUpperCase();
      const pspMinor = pspAgg.sumMinor;
      const curPsp = (pspAgg.currency ?? "").trim() || curSnap;
      const mismatch = detectPaymentMismatch({
        tenantId,
        bookingId,
        pspAmountMinor: pspMinor,
        ledgerAmountMinor: ledgerMinor,
        bookingSnapshotAmountMinor: snapshot.computedTotalMinor.trim(),
        currency: curPsp
      });
      if (mismatch) {
        findings.push(
          finding(
            PaymentReconciliationFindingKind.AMOUNT_TRIAD_MISMATCH,
            bookingId,
            "warning",
            "PSP total vs ledger booking wallet vs snapshot total differ (or parse/currency issue)",
            { reason: mismatch.reason },
            mismatch
          )
        );
      }
    }
  }

  const summaryBase = summarize(findings);
  const summary: PaymentReconciliationReportSummary = {
    ...summaryBase,
    bookingIdsExamined: bookingIds.size
  };

  return {
    id: input.reportId?.trim() || randomUUID(),
    tenantId,
    generatedAt,
    summary,
    findings
  };
}

/** JSON document suitable for object stores / tickets. */
export function formatPaymentReconciliationReportJson(report: PaymentReconciliationReport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}

/** Compact one-line JSON per finding (stream-friendly). */
export function formatPaymentReconciliationReportJsonLines(report: PaymentReconciliationReport): string {
  const head = JSON.stringify({
    type: "payment_reconciliation_report_header",
    id: report.id,
    tenantId: report.tenantId,
    generatedAt: report.generatedAt,
    summary: report.summary
  });
  const lines = [head];
  for (const f of report.findings) {
    lines.push(
      JSON.stringify({
        type: "payment_reconciliation_finding",
        reportId: report.id,
        tenantId: report.tenantId,
        ...f
      })
    );
  }
  return `${lines.join("\n")}\n`;
}

/** Human-readable summary for operators (no table engine — keep logs copy-paste friendly). */
export function formatPaymentReconciliationReportMarkdown(report: PaymentReconciliationReport): string {
  const parts: string[] = [
    `# Payment reconciliation`,
    ``,
    `- **Report id:** ${report.id}`,
    `- **Tenant:** ${report.tenantId}`,
    `- **Generated:** ${report.generatedAt}`,
    `- **Bookings examined:** ${report.summary.bookingIdsExamined}`,
    `- **Findings:** ${report.summary.findingCount} (critical: ${report.summary.criticalCount}, warning: ${report.summary.warningCount}, info: ${report.summary.infoCount})`,
    ``
  ];
  if (report.findings.length === 0) {
    parts.push(`No findings.`, ``);
    return parts.join("\n");
  }
  parts.push(`## Findings`, ``);
  for (const f of report.findings) {
    parts.push(`### ${f.kind} (${f.severity}) — booking \`${f.bookingId}\``, ``, f.message, ``);
    if (Object.keys(f.data).length > 0) {
      parts.push("```json", JSON.stringify(f.data, null, 2), "```", ``);
    }
  }
  return parts.join("\n");
}
