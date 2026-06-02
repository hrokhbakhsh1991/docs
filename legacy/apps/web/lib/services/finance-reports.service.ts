import { bffBrowserClient } from "@/lib/api/bff-browser-client";
import { BFF } from "@/lib/api-paths";

export type FinanceReportsSummary = {
  pendingManualPayments: number;
  pendingReceiptReviews: number;
  paidPayments: number;
  failedPayments: number;
};

export type FinanceOpenPaymentRow = {
  id: string;
  registrationId: string;
  amount: string;
  currency: string;
  method: string;
  status: string;
  createdAt: string;
};

function pickNum(o: Record<string, unknown>, ...keys: string[]): number {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return 0;
}

export function normalizeFinanceReportsSummary(raw: unknown): FinanceReportsSummary {
  if (!raw || typeof raw !== "object") {
    return {
      pendingManualPayments: 0,
      pendingReceiptReviews: 0,
      paidPayments: 0,
      failedPayments: 0,
    };
  }
  const o = raw as Record<string, unknown>;
  return {
    pendingManualPayments: pickNum(o, "pendingManualPayments", "pending_manual_payments"),
    pendingReceiptReviews: pickNum(o, "pendingReceiptReviews", "pending_receipt_reviews"),
    paidPayments: pickNum(o, "paidPayments", "paid_payments"),
    failedPayments: pickNum(o, "failedPayments", "failed_payments"),
  };
}

export async function getFinanceReportsSummary(): Promise<FinanceReportsSummary> {
  const raw = await bffBrowserClient.get<unknown>(BFF.financeReportsSummary);
  return normalizeFinanceReportsSummary(raw);
}

export type FinanceLedgerEventRow = {
  outboxEventId: string;
  eventType: string;
  journalId: string;
  registrationId: string | null;
  domainEventId: string | null;
  lineCount: number;
  createdAt: string;
  lines: Array<{
    id: string;
    journalId: string;
    account: string;
    side: string;
    amount_minor: string;
    currency: string;
  }>;
};

export async function listFinanceLedgerEvents(): Promise<FinanceLedgerEventRow[]> {
  const raw = await bffBrowserClient.get<unknown>(BFF.financeReportsLedgerEvents);
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((row): row is Record<string, unknown> => !!row && typeof row === "object")
    .map((row) => ({
      outboxEventId: String(row.outboxEventId ?? row.outbox_event_id ?? ""),
      eventType: String(row.eventType ?? row.event_type ?? ""),
      journalId: String(row.journalId ?? row.journal_id ?? ""),
      registrationId:
        row.registrationId != null
          ? String(row.registrationId)
          : row.registration_id != null
            ? String(row.registration_id)
            : null,
      domainEventId:
        row.domainEventId != null
          ? String(row.domainEventId)
          : row.domain_event_id != null
            ? String(row.domain_event_id)
            : null,
      lineCount: Number(row.lineCount ?? row.line_count ?? 0),
      createdAt: String(row.createdAt ?? row.created_at ?? ""),
      lines: Array.isArray(row.lines)
        ? row.lines
            .filter((line): line is Record<string, unknown> => !!line && typeof line === "object")
            .map((line) => ({
              id: String(line.id ?? ""),
              journalId: String(line.journalId ?? line.journal_id ?? ""),
              account: String(line.account ?? ""),
              side: String(line.side ?? ""),
              amount_minor: String(line.amount_minor ?? ""),
              currency: String(line.currency ?? ""),
            }))
        : [],
    }))
    .filter((row) => row.outboxEventId.length > 0);
}

export async function listFinanceOpenPayments(): Promise<FinanceOpenPaymentRow[]> {
  const raw = await bffBrowserClient.get<unknown>(BFF.financeReportsOpenPayments);
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((row): row is Record<string, unknown> => !!row && typeof row === "object")
    .map((row) => ({
      id: String(row.id ?? ""),
      registrationId: String(row.registrationId ?? row.registration_id ?? ""),
      amount: String(row.amount ?? ""),
      currency: String(row.currency ?? ""),
      method: String(row.method ?? ""),
      status: String(row.status ?? ""),
      createdAt: String(row.createdAt ?? row.created_at ?? ""),
    }))
    .filter((row) => row.id.length > 0);
}
