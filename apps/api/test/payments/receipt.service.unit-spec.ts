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
  emitPaymentCaptureAtPaid: async () => ({ lines: mockCaptureLines("reg-1"), journalId: "j-1" })
} as never;

const noopBookingLedger = {
  projectPaidAmountFromLedgerLines: () => undefined,
} as never;

const requestContextTenant1 = {
  resolveEffectiveTenantId: () => "tenant-1"
} as never;

type SubmitReceiptHarnessOptions = {
  manager: Record<string, unknown>;
  registration?: {
    id: string;
    tenantId: string;
    tourId: string;
    participantContactPhone: string;
  };
  actorPhone?: string | null;
  storage?: {
    upload?: () => Promise<{ key: string }>;
    deleteObject?: (_key: string) => Promise<void>;
  };
};

function createReceiptServiceForSubmit(options: SubmitReceiptHarnessOptions): ReceiptService {
  const registration = options.registration ?? {
    id: "reg-1",
    tenantId: "tenant-1",
    tourId: "tour-1",
    participantContactPhone: "+15550001111",
  };

  return new ReceiptService(
    {} as never,
    {
      runInTenantScope: async (_tenantId: string, fn: (_manager: unknown) => Promise<unknown>) =>
        fn(options.manager)
    } as never,
    requestContextTenant1,
    {
      upload: async () => ({ key: "tenant-1/receipts/pay-1/x.png" }),
      deleteObject: async () => undefined,
      ...options.storage,
    } as never,
    {} as never,
    {
      findRegistrationForReceipt: async () => ({
        id: registration.id,
        tenantId: registration.tenantId,
        tourId: registration.tourId,
        status: "Pending" as const,
        paymentStatus: "NotPaid" as const,
        participantContactPhone: registration.participantContactPhone,
      }),
    } as never,
    {
      getUserPhoneForReceiptUpload: async () => options.actorPhone ?? "+15550001111",
    } as never,
    { invalidateSummaryCache: async () => undefined } as never,
    noopCaptureLedger,
    noopBookingLedger
  );
}

test("submitReceipt rejects non-manual payments", async () => {
  const service = createReceiptServiceForSubmit({
    manager: {
      findOne: async () => ({
        id: "pay-1",
        tenantId: "tenant-1",
        method: PaymentMethod.ONLINE,
        status: PaymentStatus.PENDING
      })
    }
  });

  await assert.rejects(
    () =>
      service.submitReceipt({
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
  const service = createReceiptServiceForSubmit({
    manager: {
      findOne: async () => ({
        id: "pay-1",
        tenantId: "tenant-1",
        registrationId: "reg-1",
        method: PaymentMethod.MANUAL,
        status: PaymentStatus.PENDING
      })
    },
    registration: {
      id: "reg-1",
      tenantId: "tenant-1",
      tourId: "tour-1",
      participantContactPhone: "+15550009999",
    },
    actorPhone: "+15550001111",
    storage: {
      upload: async () => {
        throw new Error("upload should not run");
      },
    },
  });

  await assert.rejects(
    () =>
      service.submitReceipt({
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
  const service = createReceiptServiceForSubmit({
    manager: {
      findOne: async () => ({
        id: "pay-1",
        tenantId: "tenant-1",
        registrationId: "reg-1",
        method: PaymentMethod.MANUAL,
        status: PaymentStatus.PENDING
      }),
      find: async () => [{ status: ReceiptStatus.PENDING }]
    },
    storage: {
      upload: async () => {
        throw new Error("upload should not run");
      },
    },
  });

  await assert.rejects(
    () =>
      service.submitReceipt({
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
  const service = createReceiptServiceForSubmit({
    manager: {
      findOne: async () => ({
        id: "pay-1",
        tenantId: "tenant-1",
        registrationId: "reg-1",
        method: PaymentMethod.MANUAL,
        status: PaymentStatus.PENDING
      }),
      find: async () => [],
      create: () => ({}),
      save: async () => {
        throw new Error("db down");
      }
    },
    storage: {
      upload: async () => ({ key: "tenant-1/receipts/pay-1/x.png" }),
      deleteObject: async (key: string) => {
        deleted.push(key);
      },
    },
  });

  await assert.rejects(
    () =>
      service.submitReceipt({
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
