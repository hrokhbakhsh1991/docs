/**
 * DP1-A — PostgreSQL Payment Hold repository.
 *
 * The memory adapter remains the dev/test implementation; staging/prod must persist
 * holds because booking deadline projections are read after the approve request.
 */
import type { Prisma } from "@prisma/client";

import type { PaymentHoldRow } from "@app-tour/finance-core/infrastructure/in-memory-payment-hold.repository";

import { getPrismaAdmin } from "../db/prisma";
import { withTenantRls } from "../db/with-tenant-rls";

type FinancePaymentHoldRow = {
  readonly id: string;
  readonly tenantId: string;
  readonly registrationId: string;
  readonly status: string;
  readonly dueAt: Date;
  readonly policyHours: number;
  readonly extendedCount: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

function parseDate(value: string, code: string): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(code);
  }
  return parsed;
}

function toPaymentHoldRow(row: FinancePaymentHoldRow): PaymentHoldRow {
  if (row.status !== "open" && row.status !== "satisfied" && row.status !== "expired") {
    throw new Error(`PAYMENT_HOLD_STATUS_UNSUPPORTED:${row.status}`);
  }
  return {
    id: row.id,
    tenantId: row.tenantId,
    registrationId: row.registrationId,
    status: row.status,
    dueAt: row.dueAt.toISOString(),
    policyHours: row.policyHours,
    extendedCount: row.extendedCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function readByRegistrationId(
  tx: Prisma.TransactionClient,
  tenantId: string,
  registrationId: string
): Promise<PaymentHoldRow | null> {
  const row = await tx.financePaymentHold.findFirst({
    where: { tenantId, registrationId },
  });
  return row === null ? null : toPaymentHoldRow(row);
}

export class PrismaPaymentHoldRepository {
  async insertOpenHold(input: {
    readonly tenantId: string;
    readonly registrationId: string;
    readonly dueAt: string;
    readonly policyHours: number;
  }): Promise<PaymentHoldRow> {
    const dueAt = parseDate(input.dueAt, "PAYMENT_HOLD_DUE_AT_INVALID");
    return withTenantRls(input.tenantId, async (tx) => {
      const existing = await readByRegistrationId(tx, input.tenantId, input.registrationId);
      if (existing !== null) {
        return existing;
      }
      const row = await tx.financePaymentHold.create({
        data: {
          tenantId: input.tenantId,
          registrationId: input.registrationId,
          status: "open",
          dueAt,
          policyHours: input.policyHours,
          extendedCount: 0,
        },
      });
      return toPaymentHoldRow(row);
    });
  }

  async getByRegistrationId(
    tenantId: string,
    registrationId: string
  ): Promise<PaymentHoldRow | null> {
    return withTenantRls(tenantId, (tx) => readByRegistrationId(tx, tenantId, registrationId));
  }

  async markSatisfied(tenantId: string, registrationId: string): Promise<PaymentHoldRow> {
    return withTenantRls(tenantId, async (tx) => {
      const updated = await tx.financePaymentHold.updateMany({
        where: { tenantId, registrationId },
        data: { status: "satisfied", satisfiedAt: new Date(), expiredAt: null },
      });
      if (updated.count === 0) {
        throw new Error("PAYMENT_HOLD_NOT_FOUND");
      }
      const row = await readByRegistrationId(tx, tenantId, registrationId);
      if (row === null) {
        throw new Error("PAYMENT_HOLD_NOT_FOUND");
      }
      return row;
    });
  }

  async markExpired(tenantId: string, registrationId: string): Promise<PaymentHoldRow> {
    return withTenantRls(tenantId, async (tx) => {
      const updated = await tx.financePaymentHold.updateMany({
        where: { tenantId, registrationId },
        data: { status: "expired", expiredAt: new Date() },
      });
      if (updated.count === 0) {
        throw new Error("PAYMENT_HOLD_NOT_FOUND");
      }
      const row = await readByRegistrationId(tx, tenantId, registrationId);
      if (row === null) {
        throw new Error("PAYMENT_HOLD_NOT_FOUND");
      }
      return row;
    });
  }

  async extendDueAt(
    tenantId: string,
    registrationId: string,
    dueAt: string
  ): Promise<PaymentHoldRow> {
    const parsedDueAt = parseDate(dueAt, "PAYMENT_HOLD_DUE_AT_INVALID");
    return withTenantRls(tenantId, async (tx) => {
      const updated = await tx.financePaymentHold.updateMany({
        where: { tenantId, registrationId },
        data: {
          status: "open",
          dueAt: parsedDueAt,
          expiredAt: null,
          satisfiedAt: null,
          extendedCount: { increment: 1 },
        },
      });
      if (updated.count === 0) {
        throw new Error("PAYMENT_HOLD_NOT_FOUND");
      }
      const row = await readByRegistrationId(tx, tenantId, registrationId);
      if (row === null) {
        throw new Error("PAYMENT_HOLD_NOT_FOUND");
      }
      return row;
    });
  }

  async listOpenDueBefore(
    tenantId: string,
    beforeIso: string
  ): Promise<readonly PaymentHoldRow[]> {
    const before = parseDate(beforeIso, "PAYMENT_HOLD_SCAN_DATE_INVALID");
    return withTenantRls(tenantId, async (tx) => {
      const rows = await tx.financePaymentHold.findMany({
        where: { tenantId, status: "open", dueAt: { lte: before } },
        orderBy: [{ dueAt: "asc" }, { id: "asc" }],
      });
      return rows.map(toPaymentHoldRow);
    });
  }

  async listAllOpenDueBefore(beforeIso: string): Promise<readonly PaymentHoldRow[]> {
    const before = parseDate(beforeIso, "PAYMENT_HOLD_SCAN_DATE_INVALID");
    const rows = await getPrismaAdmin().financePaymentHold.findMany({
      where: { status: "open", dueAt: { lte: before } },
      orderBy: [{ dueAt: "asc" }, { id: "asc" }],
    });
    return rows.map(toPaymentHoldRow);
  }
}
