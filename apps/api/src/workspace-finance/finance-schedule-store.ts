import { randomUUID } from "node:crypto";

import type { FinanceSchedule } from "@prisma/client";

import { withTenantRls } from "../db/with-tenant-rls";

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

const INSTALLMENT_STATUSES = new Set<string>([
  "scheduled",
  "due",
  "partial",
  "paid",
  "overdue",
  "waived",
]);

/**
 * Schedules are durable in PostgreSQL. Kept for test API compatibility;
 * tenant cleanup (CASCADE) is the real isolation boundary.
 */
export function resetFinanceScheduleStoreForTests(): void {
  // no-op — FinanceSchedule rows live in Postgres under RLS
}

function toPaymentScheduleItem(row: FinanceSchedule): PaymentScheduleItem {
  const status = INSTALLMENT_STATUSES.has(row.status)
    ? (row.status as InstallmentItemStatus)
    : "scheduled";
  return {
    id: row.id,
    registrationId: row.registrationId,
    sequence: row.sequence,
    label: row.label,
    dueAt: row.dueAt.toISOString(),
    amountMinor: row.amountMinor,
    paidMinor: row.paidMinor,
    status,
    ...(row.linkedPaymentId !== null ? { linkedPaymentId: row.linkedPaymentId } : {}),
    ...(row.graceDays !== null ? { graceDays: row.graceDays } : {}),
  };
}

export async function listAllSchedules(tenantId: string): Promise<PaymentScheduleItem[]> {
  const normalizedTenantId = tenantId.trim();
  const rows = await withTenantRls(normalizedTenantId, (tx) =>
    tx.financeSchedule.findMany({
      where: { tenantId: normalizedTenantId },
      orderBy: [{ registrationId: "asc" }, { sequence: "asc" }],
    })
  );
  return rows.map(toPaymentScheduleItem);
}

export async function getSchedule(
  tenantId: string,
  registrationId: string
): Promise<PaymentScheduleItem[]> {
  const normalizedTenantId = tenantId.trim();
  const normalizedRegistrationId = registrationId.trim();
  const rows = await withTenantRls(normalizedTenantId, (tx) =>
    tx.financeSchedule.findMany({
      where: {
        tenantId: normalizedTenantId,
        registrationId: normalizedRegistrationId,
      },
      orderBy: { sequence: "asc" },
    })
  );
  return rows.map(toPaymentScheduleItem);
}

export async function putSchedule(
  tenantId: string,
  registrationId: string,
  items: readonly PaymentScheduleItem[]
): Promise<readonly PaymentScheduleItem[]> {
  const normalizedTenantId = tenantId.trim();
  const normalizedRegistrationId = registrationId.trim();
  const snapshot = items.map((item) => ({ ...item, registrationId: normalizedRegistrationId }));

  await withTenantRls(normalizedTenantId, async (tx) => {
    await tx.financeSchedule.deleteMany({
      where: {
        tenantId: normalizedTenantId,
        registrationId: normalizedRegistrationId,
      },
    });
    if (snapshot.length === 0) {
      return;
    }
    await tx.financeSchedule.createMany({
      data: snapshot.map((item) => ({
        id: item.id,
        tenantId: normalizedTenantId,
        registrationId: normalizedRegistrationId,
        sequence: item.sequence,
        label: item.label,
        dueAt: new Date(item.dueAt),
        amountMinor: item.amountMinor,
        paidMinor: item.paidMinor,
        status: item.status,
        linkedPaymentId: item.linkedPaymentId ?? null,
        graceDays: item.graceDays ?? null,
      })),
    });
  });

  return snapshot;
}

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
