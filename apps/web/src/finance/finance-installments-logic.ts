import type { FinanceRegistrationContext } from "@/finance/finance-registration-context";
import { parseFinanceRegistrationContext } from "@/finance/finance-registration-context";

export const FINANCE_INSTALLMENTS_TEST_IDS = {
  panel: "finance-installments-panel",
  board: "finance-installments-board",
  generateForm: "finance-schedule-generate-form",
  waiveButton: "finance-schedule-waive-button",
  rescheduleButton: "finance-schedule-reschedule-button",
  column: (column: InstallmentBoardColumn) => `finance-installments-column-${column}`,
} as const;

export type InstallmentItemStatus =
  | "scheduled"
  | "due"
  | "partial"
  | "paid"
  | "overdue"
  | "waived";

export type PaymentScheduleItem = {
  readonly id: string;
  readonly registrationId: string;
  readonly sequence: number;
  readonly label: string;
  readonly dueAt: string;
  readonly amountMinor: string;
  readonly paidMinor: string;
  readonly status: InstallmentItemStatus;
  readonly linkedPaymentId?: string;
  readonly graceDays?: number;
  readonly registrationContext: FinanceRegistrationContext | null;
};

export type InstallmentBoardColumn = "overdue" | "due_this_week" | "upcoming" | "paid";

export const INSTALLMENT_BOARD_COLUMNS: readonly InstallmentBoardColumn[] = [
  "overdue",
  "due_this_week",
  "upcoming",
  "paid",
] as const;

export const INSTALLMENT_BOARD_LABELS: Record<InstallmentBoardColumn, string> = {
  overdue: "Overdue",
  due_this_week: "Due this week",
  upcoming: "Upcoming",
  paid: "Paid",
};

export type SchedulesListResponse = {
  readonly items: readonly PaymentScheduleItem[];
};

export type GenerateScheduleFormState = {
  readonly registrationId: string;
  readonly invoiceTotalMinor: string;
  readonly depositPercent: string;
  readonly installmentCount: string;
  readonly firstDueAt: string;
  readonly currency: string;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function parseSchedulesListResponse(raw: unknown): SchedulesListResponse {
  if (raw === null || typeof raw !== "object") {
    return { items: [] };
  }
  const record = raw as Record<string, unknown>;
  const itemsRaw = record.items;
  if (!Array.isArray(itemsRaw)) {
    return { items: [] };
  }
  const items = itemsRaw
    .filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null)
    .map(parseScheduleItem)
    .filter((entry): entry is PaymentScheduleItem => entry !== null);
  return { items };
}

function parseScheduleItem(entry: Record<string, unknown>): PaymentScheduleItem | null {
  const id = String(entry.id ?? "");
  if (id.length === 0) {
    return null;
  }
  const statusRaw = String(entry.status ?? "scheduled");
  const status = isInstallmentStatus(statusRaw) ? statusRaw : "scheduled";
  return {
    id,
    registrationId: String(entry.registrationId ?? ""),
    sequence: Number(entry.sequence ?? 0),
    label: String(entry.label ?? ""),
    dueAt: String(entry.dueAt ?? ""),
    amountMinor: String(entry.amountMinor ?? "0"),
    paidMinor: String(entry.paidMinor ?? "0"),
    status,
    registrationContext: parseFinanceRegistrationContext(entry.registrationContext),
    ...(typeof entry.linkedPaymentId === "string"
      ? { linkedPaymentId: entry.linkedPaymentId }
      : {}),
    ...(typeof entry.graceDays === "number" ? { graceDays: entry.graceDays } : {}),
  };
}

function isInstallmentStatus(value: string): value is InstallmentItemStatus {
  return (
    value === "scheduled" ||
    value === "due" ||
    value === "partial" ||
    value === "paid" ||
    value === "overdue" ||
    value === "waived"
  );
}

export function classifyInstallmentBoardColumn(
  item: PaymentScheduleItem,
  now: Date = new Date()
): InstallmentBoardColumn {
  if (item.status === "paid" || item.status === "waived") {
    return "paid";
  }
  if (item.status === "overdue") {
    return "overdue";
  }
  const dueAt = new Date(item.dueAt);
  if (Number.isNaN(dueAt.getTime())) {
    return "upcoming";
  }
  const dueMs = dueAt.getTime();
  const nowMs = now.getTime();
  if (dueMs < nowMs) {
    return "overdue";
  }
  if (dueMs - nowMs <= WEEK_MS) {
    return "due_this_week";
  }
  return "upcoming";
}

export function groupInstallmentsByBoardColumn(
  items: readonly PaymentScheduleItem[],
  now: Date = new Date()
): Record<InstallmentBoardColumn, PaymentScheduleItem[]> {
  const buckets: Record<InstallmentBoardColumn, PaymentScheduleItem[]> = {
    overdue: [],
    due_this_week: [],
    upcoming: [],
    paid: [],
  };
  for (const item of items) {
    buckets[classifyInstallmentBoardColumn(item, now)].push(item);
  }
  return buckets;
}

export function validateGenerateScheduleForm(
  input: GenerateScheduleFormState
): { ok: true; value: GenerateScheduleRequestBody } | { ok: false; error: string } {
  const registrationId = input.registrationId.trim();
  if (!UUID_PATTERN.test(registrationId)) {
    return { ok: false, error: "REGISTRATION_ID_INVALID" };
  }
  const invoiceTotalMinor = input.invoiceTotalMinor.trim();
  if (!/^\d+$/.test(invoiceTotalMinor) || invoiceTotalMinor === "0") {
    return { ok: false, error: "INVOICE_TOTAL_POSITIVE" };
  }
  const depositPercent = Number(input.depositPercent);
  if (!Number.isFinite(depositPercent) || depositPercent < 0 || depositPercent > 100) {
    return { ok: false, error: "DEPOSIT_PERCENT_RANGE" };
  }
  const installmentCount = Number(input.installmentCount);
  if (!Number.isInteger(installmentCount) || installmentCount < 1 || installmentCount > 24) {
    return { ok: false, error: "INSTALLMENT_COUNT_RANGE" };
  }
  const firstDueAt = input.firstDueAt.trim();
  const parsedDue = new Date(firstDueAt);
  if (Number.isNaN(parsedDue.getTime())) {
    return { ok: false, error: "FIRST_DUE_INVALID" };
  }
  const currency = input.currency.trim().toUpperCase();
  if (currency.length < 3 || currency.length > 8) {
    return { ok: false, error: "CURRENCY_LENGTH" };
  }
  return {
    ok: true,
    value: {
      registrationId,
      template: {
        depositPercent,
        installmentCount,
        firstDueAt: parsedDue.toISOString(),
        invoiceTotalMinor,
        currency,
      },
    },
  };
}

export type GenerateScheduleRequestBody = {
  readonly registrationId: string;
  readonly template: {
    readonly depositPercent: number;
    readonly installmentCount: number;
    readonly firstDueAt: string;
    readonly invoiceTotalMinor: string;
    readonly currency: string;
  };
};

export function installmentProgressPercent(item: PaymentScheduleItem): number {
  const total = BigInt(item.amountMinor.replace(/\D/g, "") || "0");
  const paid = BigInt(item.paidMinor.replace(/\D/g, "") || "0");
  if (total <= BigInt(0)) {
    return item.status === "paid" ? 100 : 0;
  }
  const pct = Number((paid * BigInt(100)) / total);
  return Math.min(100, Math.max(0, pct));
}

export function buildWaiveScheduleItemRequestBody(reason: string): Record<string, unknown> {
  return { action: "waive", reason: reason.trim() };
}

export function buildRescheduleScheduleItemRequestBody(dueAt: string): Record<string, unknown> {
  return { action: "reschedule", dueAt: new Date(dueAt).toISOString() };
}

export function parseScheduleItemPatchResponse(raw: unknown): PaymentScheduleItem | null {
  if (raw === null || typeof raw !== "object") {
    return null;
  }
  const record = raw as Record<string, unknown>;
  const itemRaw = record.item;
  if (typeof itemRaw !== "object" || itemRaw === null) {
    return null;
  }
  return parseScheduleItem(itemRaw as Record<string, unknown>);
}
