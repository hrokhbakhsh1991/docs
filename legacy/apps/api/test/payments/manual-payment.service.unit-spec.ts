import assert from "node:assert/strict";
import test from "node:test";
import { ConflictException, NotFoundException } from "@nestjs/common";
import { ManualPaymentService } from "../../src/modules/payments/manual-payment.service";
import { PaymentMethod, PaymentStatus } from "../../src/modules/payments/entities/payment.entity";
import { PAYMENT_DEBT_AFTER_SETTLEMENT_FORBIDDEN } from "../../src/modules/payments/domain/manual-payment-debt.policy";

const TENANT_ID = "22222222-2222-4222-8222-222222222222";
const REGISTRATION_ID = "33333333-3333-4333-8333-333333333333";

const requestContext = {
  resolveEffectiveTenantId: () => TENANT_ID
};

function makePaymentRepository(findPayments: Array<{ status: PaymentStatus }>, saved: Array<Record<string, unknown>>) {
  return {
    async findRegistrationByTenantAndId(_manager: unknown, registrationId: string, tenantId: string) {
      if (registrationId === REGISTRATION_ID && tenantId === TENANT_ID) {
        return { id: REGISTRATION_ID, tenantId: TENANT_ID };
      }
      return null;
    },
    async findStatusesByRegistration() {
      return findPayments;
    },
    createPayment(_manager: unknown, data: Record<string, unknown>) {
      return data;
    },
    async savePayment(_manager: unknown, row: Record<string, unknown>) {
      saved.push(row);
      return { ...row, id: "pay-new" };
    },
    async listManualByTenant() {
      return [];
    }
  };
}

test("createManualPayment persists under tenant scope", async () => {
  const saved: Array<Record<string, unknown>> = [];
  const service = new ManualPaymentService(
    {
      runInTenantScope: async (_tenantId: string, fn: (manager: unknown) => Promise<unknown>) => fn({} as never)
    } as never,
    requestContext as never,
    makePaymentRepository([], saved) as never,
    { invalidateSummaryCache: async () => undefined } as never
  );

  const payment = await service.createManualPayment({
    registrationId: REGISTRATION_ID,
    amount: "1000",
    currency: "IRR"
  });

  assert.equal(payment.id, "pay-new");
  assert.equal(saved[0]?.method, PaymentMethod.MANUAL);
  assert.equal(saved[0]?.status, PaymentStatus.PENDING);
});

test("createManualPayment rejects when registration already has Paid payment", async () => {
  const service = new ManualPaymentService(
    {
      runInTenantScope: async (_tenantId: string, fn: (manager: unknown) => Promise<unknown>) => fn({} as never)
    } as never,
    requestContext as never,
    makePaymentRepository([{ status: PaymentStatus.PAID }], []) as never,
    { invalidateSummaryCache: async () => undefined } as never
  );

  await assert.rejects(
    () =>
      service.createManualPayment({
        registrationId: REGISTRATION_ID,
        amount: "1000",
        currency: "IRR"
      }),
    (err: unknown) => {
      assert.ok(err instanceof ConflictException);
      assert.deepEqual(err.getResponse(), PAYMENT_DEBT_AFTER_SETTLEMENT_FORBIDDEN);
      return true;
    }
  );
});

test("createManualPayment allows manual debt after Failed online payment", async () => {
  const saved: Array<Record<string, unknown>> = [];
  const service = new ManualPaymentService(
    {
      runInTenantScope: async (_tenantId: string, fn: (manager: unknown) => Promise<unknown>) => fn({} as never)
    } as never,
    requestContext as never,
    makePaymentRepository([{ status: PaymentStatus.FAILED }], saved) as never,
    { invalidateSummaryCache: async () => undefined } as never
  );

  const payment = await service.createManualPayment({
    registrationId: REGISTRATION_ID,
    amount: "1000",
    currency: "IRR"
  });
  assert.equal(payment.id, "pay-new");
});

test("createManualPayment rejects unknown registration", async () => {
  const service = new ManualPaymentService(
    {
      runInTenantScope: async (_tenantId: string, fn: (manager: unknown) => Promise<unknown>) => fn({} as never)
    } as never,
    requestContext as never,
    {
      async findRegistrationByTenantAndId() {
        return null;
      }
    } as never,
    { invalidateSummaryCache: async () => undefined } as never
  );

  await assert.rejects(
    () =>
      service.createManualPayment({
        registrationId: "44444444-4444-4444-8444-444444444444",
        amount: "1000",
        currency: "IRR"
      }),
    (err: unknown) => err instanceof NotFoundException
  );
});
