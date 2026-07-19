import type { FinanceSchedule } from "@prisma/client";

import { withTenantRls } from "../db/with-tenant-rls";
import type { PaymentScheduleItem } from "./finance-schedule-domain";

export type {
  GenerateScheduleTemplate,
  InstallmentItemStatus,
  PaymentScheduleItem,
  PrepaymentRecord,
} from "./finance-schedule-domain";
export { buildPaymentScheduleItems } from "./finance-schedule-domain";

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
    ? (row.status as PaymentScheduleItem["status"])
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
