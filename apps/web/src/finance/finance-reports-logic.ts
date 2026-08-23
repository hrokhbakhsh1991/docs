import type { AppLocale } from "@/i18n/routing";
import { toLocalizedDigits } from "@/i18n/format-localized-digits";
import type { FinanceRegistrationContext } from "@/finance/finance-registration-context";
import {
  parseFinanceRegistrationContext,
  withFinanceRegistrationQuery,
} from "@/finance/finance-registration-context";

export const FINANCE_OVERVIEW_TEST_IDS = {
  panel: "finance-overview-panel",
  kpiStrip: "finance-kpi-strip",
  paidByTour: "finance-paid-by-tour",
  collectedByTour: "finance-collected-by-tour",
  moneyOwedSection: "finance-overview-money-owed",
  needsActionSection: "finance-overview-needs-action",
  refundsAwaiting: "finance-overview-refunds-awaiting",
  refundsAwaitingEmpty: "finance-overview-refunds-awaiting-empty",
  collectionQueues: "finance-overview-collection-queues",
  outstandingPreview: "finance-overview-outstanding-preview",
  tourOwed: "finance-overview-tour-owed",
  recentLedger: "finance-recent-ledger",
  attentionList: "finance-attention-samples",
  attentionSection: "finance-attention-section",
  attentionShown: "finance-attention-shown-count",
  attentionOverflow: "finance-attention-overflow",
  attentionMorePayments: "finance-attention-more-payments",
  attentionMoreReceipts: "finance-attention-more-receipts",
  attentionMoreInstallments: "finance-attention-more-installments",
  primaryActions: "finance-overview-primary-actions",
  auditSection: "finance-overview-audit",
  triageLink: "finance-open-reconciliation-triage",
} as const;

export const FINANCE_LEDGER_TEST_IDS = {
  panel: "finance-ledger-panel",
  list: "finance-ledger-list",
  emptyState: "finance-ledger-empty",
  exportCsv: "finance-ledger-export-csv",
  eventLabel: "finance-ledger-event-label",
  eventTechnical: "finance-ledger-event-technical",
} as const;

/** Known ledger outbox event type suffixes (presentation map only). */
export const FINANCE_LEDGER_KNOWN_EVENT_KEYS = ["double_entry_applied", "capture"] as const;

export type FinanceLedgerKnownEventKey = (typeof FINANCE_LEDGER_KNOWN_EVENT_KEYS)[number];

export function ledgerEventTypeKey(eventType: string): string {
  return eventType.replace(/^finance\.ledger\./, "").trim();
}

export function isKnownFinanceLedgerEventKey(key: string): key is FinanceLedgerKnownEventKey {
  return (FINANCE_LEDGER_KNOWN_EVENT_KEYS as readonly string[]).includes(key);
}

export type FinanceLedgerCsvRow = {
  readonly outboxEventId: string;
  readonly eventType: string;
  readonly journalId: string;
  readonly registrationId: string;
  readonly domainEventId: string;
  readonly lineCount: string;
  readonly createdAt: string;
};

export type FinanceSummary = {
  readonly pendingManualPayments: number;
  readonly pendingReceiptReviews: number;
  readonly paidPayments: number;
  readonly failedPayments: number;
};

export type FinanceLedgerEvent = {
  readonly outboxEventId: string;
  readonly eventType: string;
  readonly journalId: string | null;
  readonly registrationId: string | null;
  readonly domainEventId: string | null;
  readonly lineCount: number;
  readonly createdAt: string;
  readonly registrationContext: FinanceRegistrationContext | null;
};

export type FinanceLedgerListResponse = {
  readonly items: readonly FinanceLedgerEvent[];
};

export type FinanceTourAggregateRow = {
  readonly tourId: string;
  readonly tourTitle: string;
  readonly currency: string;
  readonly paidCount: number;
  readonly paidMinor: string;
  readonly pendingCount: number;
};

export type FinanceByTourReport = {
  readonly items: readonly FinanceTourAggregateRow[];
};

export function parseFinanceByTourReport(raw: unknown): FinanceByTourReport {
  if (raw === null || typeof raw !== "object") {
    return { items: [] };
  }
  const record = raw as Record<string, unknown>;
  if (!Array.isArray(record.items)) {
    return { items: [] };
  }
  const items = record.items
    .filter(
      (entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null
    )
    .map((entry) => ({
      tourId: String(entry.tourId ?? ""),
      tourTitle: String(entry.tourTitle ?? ""),
      currency: String(entry.currency ?? ""),
      paidCount: readCount(entry.paidCount),
      paidMinor: String(entry.paidMinor ?? "0"),
      pendingCount: readCount(entry.pendingCount),
    }))
    .filter((entry) => entry.tourId.length > 0 && entry.tourTitle.length > 0);
  return { items };
}

export function parseFinanceSummary(raw: unknown): FinanceSummary {
  if (raw === null || typeof raw !== "object") {
    return {
      pendingManualPayments: 0,
      pendingReceiptReviews: 0,
      paidPayments: 0,
      failedPayments: 0,
    };
  }
  const record = raw as Record<string, unknown>;
  return {
    pendingManualPayments: readCount(record.pendingManualPayments),
    pendingReceiptReviews: readCount(record.pendingReceiptReviews),
    paidPayments: readCount(record.paidPayments),
    failedPayments: readCount(record.failedPayments),
  };
}

function readCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function parseFinanceLedgerListResponse(raw: unknown): FinanceLedgerListResponse {
  if (raw === null || typeof raw !== "object") {
    return { items: [] };
  }
  const record = raw as Record<string, unknown>;
  if (!Array.isArray(record.items)) {
    return { items: [] };
  }
  const items = record.items
    .filter(
      (entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null
    )
    .map((entry) => ({
      outboxEventId: String(entry.outboxEventId ?? entry.id ?? ""),
      eventType: String(entry.eventType ?? ""),
      journalId: typeof entry.journalId === "string" ? entry.journalId : null,
      registrationId: typeof entry.registrationId === "string" ? entry.registrationId : null,
      domainEventId: typeof entry.domainEventId === "string" ? entry.domainEventId : null,
      lineCount: typeof entry.lineCount === "number" ? entry.lineCount : 0,
      createdAt: String(entry.createdAt ?? ""),
      registrationContext: parseFinanceRegistrationContext(entry.registrationContext),
    }))
    .filter((entry) => entry.outboxEventId.length > 0);
  return { items };
}

const FINANCE_TIMESTAMP_LOCALE: Record<AppLocale, string> = {
  fa: "fa-IR",
  en: "en-US",
};

/**
 * English humanized fallback for unknown event types / tests.
 * Prefer `resolveFinanceLedgerEventLabel` with i18n in UI.
 */
export function formatLedgerEventLabel(eventType: string): string {
  return ledgerEventTypeKey(eventType).replaceAll("_", " ");
}

/**
 * Presentation label for ledger list rows. Known types use i18n; unknown stay
 * humanized without dominating with the raw type (raw type is secondary in UI).
 */
export function resolveFinanceLedgerEventLabel(
  eventType: string,
  t: (key: string) => string
): string {
  const key = ledgerEventTypeKey(eventType);
  if (isKnownFinanceLedgerEventKey(key)) {
    try {
      return t(`eventTypes.${key}`);
    } catch {
      return formatLedgerEventLabel(eventType);
    }
  }
  return formatLedgerEventLabel(eventType);
}

export function formatFinanceTimestamp(iso: string, locale: AppLocale = "en"): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return toLocalizedDigits(
    date.toLocaleString(FINANCE_TIMESTAMP_LOCALE[locale], {
      dateStyle: "medium",
      timeStyle: "short",
    }),
    locale
  );
}

function escapeCsvCell(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

export function toFinanceLedgerCsvRows(
  items: readonly FinanceLedgerEvent[]
): readonly FinanceLedgerCsvRow[] {
  return items.map((event) => ({
    outboxEventId: event.outboxEventId,
    eventType: event.eventType,
    journalId: event.journalId ?? "",
    registrationId: event.registrationId ?? "",
    domainEventId: event.domainEventId ?? "",
    lineCount: String(event.lineCount),
    createdAt: event.createdAt,
  }));
}

export function buildFinanceLedgerCsvContent(rows: readonly FinanceLedgerCsvRow[]): string {
  const header =
    "outboxEventId,eventType,journalId,registrationId,domainEventId,lineCount,createdAt";
  const lines = rows.map((row) =>
    [
      row.outboxEventId,
      row.eventType,
      row.journalId,
      row.registrationId,
      row.domainEventId,
      row.lineCount,
      row.createdAt,
    ]
      .map(escapeCsvCell)
      .join(",")
  );
  return [header, ...lines].join("\n");
}

export function buildFinanceLedgerCsvFilename(tenantSlug: string, date: Date = new Date()): string {
  const normalized =
    tenantSlug
      .trim()
      .toLowerCase()
      .replaceAll(/[^a-z0-9-]+/g, "-") || "tenant";
  const stamp = date.toISOString().slice(0, 10);
  return `finance-ledger-${normalized}-${stamp}.csv`;
}

export type FinanceKpiCard = {
  readonly id: string;
  readonly label: string;
  readonly value: number;
  readonly href?: string;
  readonly tone?: "default" | "warning" | "success";
};

export type BuildFinanceKpiCardsOptions = {
  /** When false (first-customer default), omit overdue-installments KPI. */
  readonly includeInstallments?: boolean;
};

export function buildFinanceKpiCards(
  summary: FinanceSummary,
  overdueInstallments = 0,
  options: BuildFinanceKpiCardsOptions = {}
): readonly FinanceKpiCard[] {
  const includeInstallments = options.includeInstallments === true;
  const cards: FinanceKpiCard[] = [
    {
      id: "pending-manual",
      label: "Pending manual payments",
      value: summary.pendingManualPayments,
      href: "/finance?tab=payments",
      tone: summary.pendingManualPayments > 0 ? "warning" : "default",
    },
    {
      id: "pending-receipts",
      label: "Receipts awaiting review",
      value: summary.pendingReceiptReviews,
      href: "/finance?tab=receipts",
      tone: summary.pendingReceiptReviews > 0 ? "warning" : "default",
    },
  ];
  if (includeInstallments) {
    cards.push({
      id: "overdue-installments",
      label: "Overdue installments",
      value: overdueInstallments,
      href: "/finance?tab=installments",
      tone: overdueInstallments > 0 ? "warning" : "default",
    });
  }
  cards.push({
    id: "paid-payments",
    label: "Paid payments",
    value: summary.paidPayments,
    tone: "success",
  });
  return cards;
}

/** Phase E — up to 3 operator attention rows with registration identity (no money math). */
export const FINANCE_ATTENTION_SAMPLE_LIMIT = 3;

export type FinanceAttentionKind = "overdue-installment" | "pending-receipt" | "pending-manual";

export type FinanceAttentionSample = {
  readonly id: string;
  readonly kind: FinanceAttentionKind;
  readonly registrationId: string;
  readonly registrationContext: FinanceRegistrationContext | null;
  readonly href: string;
  readonly secondaryLabel: string | null;
};

export type FinanceAttentionSampleInput = {
  readonly overdueInstallments: ReadonlyArray<{
    readonly id: string;
    readonly registrationId: string;
    readonly label: string;
    readonly registrationContext: FinanceRegistrationContext | null;
  }>;
  readonly pendingReceipts: ReadonlyArray<{
    readonly id: string;
    readonly registrationId: string;
    readonly registrationContext: FinanceRegistrationContext | null;
  }>;
  readonly pendingManualPayments: ReadonlyArray<{
    readonly id: string;
    readonly registrationId: string;
    readonly status: string;
    readonly registrationContext: FinanceRegistrationContext | null;
  }>;
  readonly limit?: number;
  /**
   * When false (first-customer default), skip overdue-installment samples and
   * do not emit installments-tab hrefs. Receipts then manuals take priority.
   */
  readonly includeInstallments?: boolean;
};

export function buildFinanceAttentionSamples(
  input: FinanceAttentionSampleInput
): readonly FinanceAttentionSample[] {
  const limit = input.limit ?? FINANCE_ATTENTION_SAMPLE_LIMIT;
  const includeInstallments = input.includeInstallments === true;
  const samples: FinanceAttentionSample[] = [];

  if (includeInstallments) {
    for (const row of input.overdueInstallments) {
      if (samples.length >= limit) break;
      if (!row.registrationId) continue;
      samples.push({
        id: `overdue:${row.id}`,
        kind: "overdue-installment",
        registrationId: row.registrationId,
        registrationContext: row.registrationContext,
        href: withFinanceRegistrationQuery("/finance?tab=installments", row.registrationId),
        secondaryLabel: row.label || null,
      });
    }
  }

  // First-customer (and after overdue slots): receipts → pending manuals.
  for (const row of input.pendingReceipts) {
    if (samples.length >= limit) break;
    if (!row.registrationId) continue;
    samples.push({
      id: `receipt:${row.id}`,
      kind: "pending-receipt",
      registrationId: row.registrationId,
      registrationContext: row.registrationContext,
      href: withFinanceRegistrationQuery("/finance?tab=receipts", row.registrationId),
      secondaryLabel: null,
    });
  }

  for (const row of input.pendingManualPayments) {
    if (samples.length >= limit) break;
    if (!row.registrationId) continue;
    const status = row.status.trim().toLowerCase();
    if (status !== "pending" && status !== "manual") continue;
    samples.push({
      id: `payment:${row.id}`,
      kind: "pending-manual",
      registrationId: row.registrationId,
      registrationContext: row.registrationContext,
      href: withFinanceRegistrationQuery("/finance?tab=payments", row.registrationId),
      secondaryLabel: null,
    });
  }

  return samples;
}

/**
 * PR21-G4 — compare attention preview size to aggregate summary totals.
 * Overflow is kind-aware so mixed queues are not labelled as “payments only”.
 */
export type FinanceAttentionOverflow = {
  readonly shownCount: number;
  readonly morePendingManual: number;
  readonly morePendingReceipt: number;
  readonly moreOverdueInstallment: number;
  readonly hasOverflow: boolean;
};

export type ResolveFinanceAttentionOverflowInput = {
  readonly samples: readonly FinanceAttentionSample[];
  readonly pendingManualTotal: number;
  readonly pendingReceiptTotal: number;
  readonly overdueInstallmentTotal: number;
  readonly includeInstallments?: boolean;
};

export function resolveFinanceAttentionOverflow(
  input: ResolveFinanceAttentionOverflowInput
): FinanceAttentionOverflow {
  const shownPendingManual = input.samples.filter((s) => s.kind === "pending-manual").length;
  const shownPendingReceipt = input.samples.filter((s) => s.kind === "pending-receipt").length;
  const shownOverdue = input.samples.filter((s) => s.kind === "overdue-installment").length;
  const morePendingManual = Math.max(0, input.pendingManualTotal - shownPendingManual);
  const morePendingReceipt = Math.max(0, input.pendingReceiptTotal - shownPendingReceipt);
  const moreOverdueInstallment =
    input.includeInstallments === true
      ? Math.max(0, input.overdueInstallmentTotal - shownOverdue)
      : 0;
  return {
    shownCount: input.samples.length,
    morePendingManual,
    morePendingReceipt,
    moreOverdueInstallment,
    hasOverflow: morePendingManual > 0 || morePendingReceipt > 0 || moreOverdueInstallment > 0,
  };
}
