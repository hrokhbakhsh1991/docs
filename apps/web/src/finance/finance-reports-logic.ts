import type { AppLocale } from "@/i18n/routing";
import { toLocalizedDigits } from "@/i18n/format-localized-digits";

export const FINANCE_OVERVIEW_TEST_IDS = {
  panel: "finance-overview-panel",
  kpiStrip: "finance-kpi-strip",
  recentLedger: "finance-recent-ledger",
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
};

export type FinanceLedgerListResponse = {
  readonly items: readonly FinanceLedgerEvent[];
};

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
