import type { AppLocale } from "@/i18n/routing";
import { toLocalizedDigits } from "@/i18n/format-localized-digits";
import type { FinanceRegistrationContext } from "@/finance/finance-registration-context";
import { parseFinanceRegistrationContext } from "@/finance/finance-registration-context";

export const FINANCE_OVERVIEW_TEST_IDS = {
  panel: "finance-overview-panel",
  kpiStrip: "finance-kpi-strip",
  paidByTour: "finance-paid-by-tour",
  recentLedger: "finance-recent-ledger",
  attentionList: "finance-attention-samples",
  triageLink: "finance-open-reconciliation-triage",
} as const;

export const FINANCE_LEDGER_TEST_IDS = {
  panel: "finance-ledger-panel",
  list: "finance-ledger-list",
  exportCsv: "finance-ledger-export-csv",
} as const;

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
    .filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null)
    .map((entry) => ({
      tourId: String(entry.tourId ?? ""),
      tourTitle: String(entry.tourTitle ?? ""),
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
    .filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null)
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

export function formatLedgerEventLabel(eventType: string): string {
  return eventType.replace(/^finance\.ledger\./, "").replaceAll("_", " ");
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

export function buildFinanceLedgerCsvFilename(
  tenantSlug: string,
  date: Date = new Date()
): string {
  const normalized = tenantSlug.trim().toLowerCase().replaceAll(/[^a-z0-9-]+/g, "-") || "tenant";
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

export function buildFinanceKpiCards(
  summary: FinanceSummary,
  overdueInstallments = 0
): readonly FinanceKpiCard[] {
  return [
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
    {
      id: "overdue-installments",
      label: "Overdue installments",
      value: overdueInstallments,
      href: "/finance?tab=installments",
      tone: overdueInstallments > 0 ? "warning" : "default",
    },
    {
      id: "paid-payments",
      label: "Paid payments",
      value: summary.paidPayments,
      tone: "success",
    },
  ];
}

/** Phase E — up to 3 operator attention rows with registration identity (no money math). */
export const FINANCE_ATTENTION_SAMPLE_LIMIT = 3;

export type FinanceAttentionKind =
  | "overdue-installment"
  | "pending-receipt"
  | "pending-manual";

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
};

export function buildFinanceAttentionSamples(
  input: FinanceAttentionSampleInput
): readonly FinanceAttentionSample[] {
  const limit = input.limit ?? FINANCE_ATTENTION_SAMPLE_LIMIT;
  const samples: FinanceAttentionSample[] = [];

  for (const row of input.overdueInstallments) {
    if (samples.length >= limit) break;
    if (!row.registrationId) continue;
    samples.push({
      id: `overdue:${row.id}`,
      kind: "overdue-installment",
      registrationId: row.registrationId,
      registrationContext: row.registrationContext,
      href: "/finance?tab=installments",
      secondaryLabel: row.label || null,
    });
  }

  for (const row of input.pendingReceipts) {
    if (samples.length >= limit) break;
    if (!row.registrationId) continue;
    samples.push({
      id: `receipt:${row.id}`,
      kind: "pending-receipt",
      registrationId: row.registrationId,
      registrationContext: row.registrationContext,
      href: "/finance?tab=receipts",
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
      href: "/finance?tab=payments",
      secondaryLabel: null,
    });
  }

  return samples;
}
