import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import type { PrismaClient } from "@prisma/client";

import { __testBindPrismaClientForQueryCapture, disconnectPrisma } from "../../db/prisma";
import { PrismaFinanceRepository } from "./prisma-finance.repository";

const TENANT_ID = "00000000-0000-4000-8000-000000000701";
const REGISTRATION_ID = "00000000-0000-4000-8000-000000000702";

type FindFirstArgs = {
  readonly where: {
    readonly status?: string;
    readonly tenantId: string;
    readonly payment: { readonly tenantId: string; readonly registrationId: string };
  };
};

function receiptRow(id: string, status: "Pending" | "Rejected") {
  const createdAt = new Date("2026-10-23T10:00:00.000Z");
  return {
    id,
    paymentId: "00000000-0000-4000-8000-000000000703",
    fileKey: null,
    status,
    note: null,
    reviewNote: status === "Rejected" ? "توضیح اصلاح رسید" : null,
    reviewedAt: status === "Rejected" ? createdAt : null,
    ledgerJournalId: null,
    createdAt,
    payment: {
      id: "00000000-0000-4000-8000-000000000703",
      registrationId: REGISTRATION_ID,
      amount: "2500000",
      currency: "IRR",
      method: "Manual",
      status: "Pending",
      provider: "manual",
      paidAt: null,
      createdAt,
    },
  };
}

function bindFakePrisma(findFirst: (args: FindFirstArgs) => ReturnType<typeof receiptRow> | null): {
  readonly calls: FindFirstArgs[];
} {
  const calls: FindFirstArgs[] = [];
  const fakeTransaction = {
    async $executeRaw() {
      return 1;
    },
    paymentReceipt: {
      async findFirst(args: FindFirstArgs) {
        calls.push(args);
        return findFirst(args);
      },
    },
  };
  const fakeClient = {
    async $transaction(run: (tx: typeof fakeTransaction) => Promise<unknown>) {
      return run(fakeTransaction);
    },
    async $disconnect() {},
  };

  __testBindPrismaClientForQueryCapture(fakeClient as unknown as PrismaClient);
  return { calls };
}

afterEach(async () => {
  await disconnectPrisma();
});

describe("PrismaFinanceRepository.findLatestReceiptForRegistration", () => {
  it("prefers an active pending retry when receipt timestamps tie", async () => {
    const rejected = receiptRow("receipt-rejected", "Rejected");
    const pending = receiptRow("receipt-pending-retry", "Pending");
    const { calls } = bindFakePrisma((args) =>
      args.where.status === "Pending" ? pending : rejected
    );
    const repository = new PrismaFinanceRepository({} as never);

    const actual = await repository.findLatestReceiptForRegistration(TENANT_ID, REGISTRATION_ID);

    assert.equal(actual?.id, pending.id);
    assert.equal(calls.length, 1, "fallback query is unnecessary when a pending receipt exists");
    assert.deepEqual(calls[0]?.where, {
      tenantId: TENANT_ID,
      payment: { tenantId: TENANT_ID, registrationId: REGISTRATION_ID },
      status: "Pending",
    });
  });

  it("falls back to the latest reviewed receipt when there is no active attempt", async () => {
    const rejected = receiptRow("receipt-rejected", "Rejected");
    const { calls } = bindFakePrisma((args) => (args.where.status === "Pending" ? null : rejected));
    const repository = new PrismaFinanceRepository({} as never);

    const actual = await repository.findLatestReceiptForRegistration(TENANT_ID, REGISTRATION_ID);

    assert.equal(actual?.id, rejected.id);
    assert.equal(calls.length, 2);
    assert.equal(calls[0]?.where.status, "Pending");
    assert.equal(calls[1]?.where.status, undefined);
  });
});
