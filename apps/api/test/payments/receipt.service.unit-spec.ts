import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException, ConflictException, ForbiddenException } from "@nestjs/common";
import { ReceiptStatus } from "../../src/modules/payments/entities/payment-receipt.entity";
import { ReceiptService } from "../../src/modules/finance/receipts/receipt.service";
import { PaymentMethod, PaymentStatus } from "../../src/modules/payments/entities/payment.entity";
import { UserRole } from "../../src/common/auth/user-role.enum";
import type { LedgerJournalLine } from "../../src/modules/finance/ledger/ledger-journal-line";

function mockCaptureLines(
  registrationId: string,
  amountMinor = "1200000"
): [LedgerJournalLine, LedgerJournalLine] {
  const journalId = "journal-mock";
  const createdAt = "2030-01-01T00:00:00.000Z";
  return [
    {
      id: "line-debit",
      journalId,
      tenantId: "tenant-1",
      account: "gl:leader-registration-payment-clearing",
      side: "debit",
      amount_minor: amountMinor,
      currency: "IRR",
      correlationId: "mock:debit",
      idempotencyKey: "mock:debit",
      createdAt
    },
    {
      id: "line-credit",
      journalId,
      tenantId: "tenant-1",
      account: `booking:${registrationId}`,
      side: "credit",
      amount_minor: amountMinor,
      currency: "IRR",
      correlationId: "mock:credit",
      idempotencyKey: "mock:credit",
      createdAt
    }
  ];
}

const noopCaptureLedger = {
  emitPaymentCaptureAtPaid: async () => ({ lines: mockCaptureLines("reg-1") })
} as never;

const noopBookingLedger = {
  applyPaidAmountProjectionToRegistration: () => undefined
} as never;

test("submitReceipt rejects non-manual payments", async () => {
  const service = new ReceiptService(
    {} as never,
    {
      runInTenantScope: async (_tenantId: string, fn: any) =>
        fn({
          findOne: async () => ({
            id: "pay-1",
            tenantId: "tenant-1",
            method: PaymentMethod.ONLINE,
            status: PaymentStatus.PENDING
          })
        } as never)
    } as never,
    {
      upload: async () => ({ key: "k" })
    } as never,
    {} as never,
    { invalidateSummaryCache: async () => undefined } as never,
    noopCaptureLedger,
    noopBookingLedger
  );

  await assert.rejects(
    () =>
      service.submitReceipt({
        tenantId: "tenant-1",
        paymentId: "pay-1",
        actorUserId: "user-1",
        actorRole: UserRole.Member,
        file: Buffer.from("x"),
        contentType: "image/png"
      }),
    (err: unknown) => err instanceof BadRequestException
  );
});

test("submitReceipt rejects upload by unrelated member", async () => {
  const service = new ReceiptService(
    {} as never,
    {
      runInTenantScope: async (_tenantId: string, fn: any) =>
        fn({
          findOne: async (_entity: unknown, opts: { where: { id?: string } }) => {
            if (opts.where.id === "pay-1") {
              return {
                id: "pay-1",
                tenantId: "tenant-1",
                registrationId: "reg-1",
                method: PaymentMethod.MANUAL,
                status: PaymentStatus.PENDING
              };
            }
            if (opts.where.id === "reg-1") {
              return {
                id: "reg-1",
                participantContactPhone: "+15550009999"
              };
            }
            if (opts.where.id === "user-other") {
              return { id: "user-other", phone: "+15550001111" };
            }
            return null;
          }
        } as never)
    } as never,
    {
      upload: async () => {
        throw new Error("upload should not run");
      }
    } as never,
    {} as never,
    { invalidateSummaryCache: async () => undefined } as never,
    noopCaptureLedger,
    noopBookingLedger
  );

  await assert.rejects(
    () =>
      service.submitReceipt({
        tenantId: "tenant-1",
        paymentId: "pay-1",
        actorUserId: "user-other",
        actorRole: UserRole.Member,
        file: Buffer.from("x"),
        contentType: "image/png"
      }),
    (err: unknown) => err instanceof ForbiddenException
  );
});

test("submitReceipt rejects second pending receipt for same payment", async () => {
  const service = new ReceiptService(
    {} as never,
    {
      runInTenantScope: async (_tenantId: string, fn: any) =>
        fn({
          findOne: async (_entity: unknown, opts: { where: { id?: string } }) => {
            if (opts.where.id === "pay-1") {
              return {
                id: "pay-1",
                tenantId: "tenant-1",
                registrationId: "reg-1",
                method: PaymentMethod.MANUAL,
                status: PaymentStatus.PENDING
              };
            }
            if (opts.where.id === "reg-1") {
              return {
                id: "reg-1",
                participantContactPhone: "+15550001111"
              };
            }
            if (opts.where.id === "user-1") {
              return { id: "user-1", phone: "+15550001111" };
            }
            return null;
          },
          find: async () => [{ status: ReceiptStatus.PENDING }]
        } as never)
    } as never,
    {
      upload: async () => {
        throw new Error("upload should not run");
      }
    } as never,
    {} as never,
    { invalidateSummaryCache: async () => undefined } as never,
    noopCaptureLedger,
    noopBookingLedger
  );

  await assert.rejects(
    () =>
      service.submitReceipt({
        tenantId: "tenant-1",
        paymentId: "pay-1",
        actorUserId: "user-1",
        actorRole: UserRole.Member,
        file: Buffer.from("x"),
        contentType: "image/png"
      }),
    (err: unknown) => err instanceof ConflictException
  );
});

test("submitReceipt deletes uploaded object when save fails", async () => {
  const deleted: string[] = [];
  const service = new ReceiptService(
    {} as never,
    {
      runInTenantScope: async (_tenantId: string, fn: any) =>
        fn({
          findOne: async (_entity: unknown, opts: { where: { id?: string } }) => {
            if (opts.where.id === "pay-1") {
              return {
                id: "pay-1",
                tenantId: "tenant-1",
                registrationId: "reg-1",
                method: PaymentMethod.MANUAL,
                status: PaymentStatus.PENDING
              };
            }
            if (opts.where.id === "reg-1") {
              return {
                id: "reg-1",
                participantContactPhone: "+15550001111"
              };
            }
            if (opts.where.id === "user-1") {
              return { id: "user-1", phone: "+15550001111" };
            }
            return null;
          },
          find: async () => [],
          create: () => ({}),
          save: async () => {
            throw new Error("db down");
          }
        } as never)
    } as never,
    {
      upload: async () => ({ key: "tenant-1/receipts/pay-1/x.png" }),
      deleteObject: async (key: string) => {
        deleted.push(key);
      }
    } as never,
    {} as never,
    { invalidateSummaryCache: async () => undefined } as never,
    noopCaptureLedger,
    noopBookingLedger
  );

  await assert.rejects(
    () =>
      service.submitReceipt({
        tenantId: "tenant-1",
        paymentId: "pay-1",
        actorUserId: "user-1",
        actorRole: UserRole.Owner,
        file: Buffer.from("x"),
        contentType: "image/png"
      }),
    (err: unknown) => err instanceof Error && (err as Error).message === "db down"
  );
  assert.deepEqual(deleted, ["tenant-1/receipts/pay-1/x.png"]);
});
