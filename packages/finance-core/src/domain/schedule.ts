/**
 * Schedule domain types + pure installment generation (no Prisma / RLS / host I/O).
 */

import { randomUUID } from "node:crypto";

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
};

export type PrepaymentRecord = {
  readonly id: string;
  readonly registrationId: string;
  readonly amountMinor: string;
  readonly currency: string;
  readonly method: string;
  readonly note: string | null;
  readonly recordedAt: string;
};

export type GenerateScheduleTemplate = {
  readonly depositPercent: number;
  readonly installmentCount: number;
  readonly graceDays?: number;
  readonly firstDueAt: string;
  readonly invoiceTotalMinor: string;
  readonly currency: string;
};

function splitMinorTotal(totalMinor: bigint, parts: number): bigint[] {
  if (parts <= 0) {
    return [];
  }
  const base = totalMinor / BigInt(parts);
  const remainder = totalMinor % BigInt(parts);
  return Array.from({ length: parts }, (_, index) =>
    index === parts - 1 ? base + remainder : base
  );
}

export function buildPaymentScheduleItems(input: {
  readonly registrationId: string;
  readonly template: GenerateScheduleTemplate;
}): PaymentScheduleItem[] {
  const totalMinor = BigInt(input.template.invoiceTotalMinor);
  const depositPercent = Math.min(Math.max(input.template.depositPercent, 0), 100);
  const installmentCount = Math.max(input.template.installmentCount, 1);
  const depositMinor = (totalMinor * BigInt(depositPercent)) / BigInt(100);
  const remainderMinor = totalMinor - depositMinor;
  const installmentParts = splitMinorTotal(remainderMinor, installmentCount);

  const items: PaymentScheduleItem[] = [];
  const firstDue = new Date(input.template.firstDueAt);
  if (Number.isNaN(firstDue.getTime())) {
    throw new Error("SCHEDULE_INVALID_FIRST_DUE");
  }

  if (depositMinor > BigInt(0)) {
    items.push({
      id: randomUUID(),
      registrationId: input.registrationId,
      sequence: 0,
      label: "Prepayment",
      dueAt: firstDue.toISOString(),
      amountMinor: depositMinor.toString(),
      paidMinor: "0",
      status: "due",
      graceDays: input.template.graceDays,
    });
  }

  installmentParts.forEach((amountMinor, index) => {
    const due = new Date(firstDue);
    due.setUTCMonth(due.getUTCMonth() + index + 1);
    items.push({
      id: randomUUID(),
      registrationId: input.registrationId,
      sequence: index + 1,
      label: `Installment ${index + 1}`,
      dueAt: due.toISOString(),
      amountMinor: amountMinor.toString(),
      paidMinor: "0",
      status: "scheduled",
      graceDays: input.template.graceDays,
    });
  });

  const sum = items.reduce((acc, row) => acc + BigInt(row.amountMinor), BigInt(0));
  if (sum !== totalMinor) {
    throw new Error("SCHEDULE_INVOICE_MISMATCH");
  }

  return items;
}

export function assertScheduleAmountSumInvariant(
  items: readonly PaymentScheduleItem[],
  expectedTotalMinor: string
): void {
  const sum = items.reduce((acc, row) => acc + BigInt(row.amountMinor), BigInt(0));
  if (sum !== BigInt(expectedTotalMinor)) {
    throw new Error("SCHEDULE_INVOICE_MISMATCH");
  }
}

function recalcStatusAfterReschedule(
  item: PaymentScheduleItem,
  dueAt: string
): InstallmentItemStatus {
  if (item.status === "waived" || item.status === "paid" || item.status === "partial") {
    return item.status;
  }
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) {
    throw new Error("SCHEDULE_INVALID_DUE_AT");
  }
  const now = new Date();
  if (due.getTime() < now.getTime()) {
    return "overdue";
  }
  if (item.status === "overdue") {
    return "scheduled";
  }
  return item.status;
}

export function waivePaymentScheduleItem(
  items: readonly PaymentScheduleItem[],
  itemId: string
): PaymentScheduleItem[] {
  const index = items.findIndex((row) => row.id === itemId);
  if (index < 0) {
    throw new Error("SCHEDULE_ITEM_NOT_FOUND");
  }
  const item = items[index]!;
  if (item.status === "paid") {
    throw new Error("SCHEDULE_ITEM_ALREADY_PAID");
  }
  if (item.status === "waived") {
    return [...items];
  }
  const next = [...items];
  next[index] = { ...item, status: "waived" };
  return next;
}

export function reschedulePaymentScheduleItem(
  items: readonly PaymentScheduleItem[],
  itemId: string,
  dueAt: string
): PaymentScheduleItem[] {
  const index = items.findIndex((row) => row.id === itemId);
  if (index < 0) {
    throw new Error("SCHEDULE_ITEM_NOT_FOUND");
  }
  const item = items[index]!;
  if (item.status === "paid" || item.status === "waived") {
    throw new Error("SCHEDULE_ITEM_NOT_MUTABLE");
  }
  const parsedDue = new Date(dueAt);
  if (Number.isNaN(parsedDue.getTime())) {
    throw new Error("SCHEDULE_INVALID_DUE_AT");
  }
  const next = [...items];
  next[index] = {
    ...item,
    dueAt: parsedDue.toISOString(),
    status: recalcStatusAfterReschedule(item, parsedDue.toISOString()),
  };
  return next;
}
