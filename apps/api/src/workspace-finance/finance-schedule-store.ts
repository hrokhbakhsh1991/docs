import type { FinanceSchedule } from "@prisma/client";

import { withTenantRls } from "../db/with-tenant-rls";
import { resolveStorageDriver } from "../storage/production-storage-driver-assert";
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

/** In-memory schedules when STORAGE_DRIVER=memory (P6 / unit HTTP gates). */
const memorySchedulesByRegistration = new Map<string, PaymentScheduleItem[]>();

function memoryKey(tenantId: string, registrationId: string): string {
  return `${tenantId.trim()}\0${registrationId.trim()}`;
}

function useMemoryScheduleStore(): boolean {
  return resolveStorageDriver() === "memory";
}

/**
 * Clears in-memory schedule rows for memory-driver tests.
 * Prisma path relies on tenant CASCADE / truncate between suites.
 */
export function resetFinanceScheduleStoreForTests(): void {
  memorySchedulesByRegistration.clear();
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
  if (useMemoryScheduleStore()) {
    const prefix = `${normalizedTenantId}\0`;
    const items: PaymentScheduleItem[] = [];
    for (const [key, rows] of memorySchedulesByRegistration.entries()) {
      if (key.startsWith(prefix)) {
        items.push(...rows);
      }
    }
    return items.sort((a, b) =>
      a.registrationId === b.registrationId
        ? a.sequence - b.sequence
        : a.registrationId.localeCompare(b.registrationId)
    );
  }
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
  if (useMemoryScheduleStore()) {
    return memorySchedulesByRegistration.get(memoryKey(normalizedTenantId, normalizedRegistrationId)) ?? [];
  }
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

  if (useMemoryScheduleStore()) {
    memorySchedulesByRegistration.set(
      memoryKey(normalizedTenantId, normalizedRegistrationId),
      snapshot.map((item) => ({ ...item }))
    );
    return snapshot;
  }

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
