import assert from "node:assert/strict";
import test from "node:test";
import { ConflictException, NotFoundException } from "@nestjs/common";
import { ManualPaymentService } from "../../src/modules/payments/manual-payment.service";
import { PaymentMethod, PaymentStatus } from "../../src/modules/payments/entities/payment.entity";
import { PAYMENT_DEBT_AFTER_SETTLEMENT_FORBIDDEN } from "../../src/modules/payments/domain/manual-payment-debt.policy";

function makeManager(findPayments: Array<{ status: PaymentStatus }>) {
  return {
    findOne: async () => ({
      id: "reg-1",
      tenantId: "tenant-1"
    }),
    find: async () => findPayments,
    create: (_entity: unknown, data: Record<string, unknown>) => data,
    save: async (_entity: unknown, row: Record<string, unknown>) => ({ ...row, id: "pay-new" })
  };
}

test("createManualPayment persists under tenant scope", async () => {
  const saved: Array<Record<string, unknown>> = [];
  const service = new ManualPaymentService(
    {
      runInTenantScope: async (_tenantId, fn) =>
        fn({
          ...makeManager([]),
          save: async (_entity: unknown, row: Record<string, unknown>) => {
            saved.push(row);
            return { ...row, id: "pay-new" };
          }
        } as never)
    } as never,
    {} as never,
    { invalidateSummaryCache: async () => undefined } as never
  );

  const payment = await service.createManualPayment({
    tenantId: "tenant-1",
    registrationId: "reg-1",
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
      runInTenantScope: async (_tenantId, fn) => fn(makeManager([{ status: PaymentStatus.PAID }]) as never)
    } as never,
    {} as never,
    { invalidateSummaryCache: async () => undefined } as never
  );

  await assert.rejects(
    () =>
      service.createManualPayment({
        tenantId: "tenant-1",
        registrationId: "reg-1",
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
  const service = new ManualPaymentService(
    {
      runInTenantScope: async (_tenantId, fn) => fn(makeManager([{ status: PaymentStatus.FAILED }]) as never)
    } as never,
    {} as never,
    { invalidateSummaryCache: async () => undefined } as never
  );

  const payment = await service.createManualPayment({
    tenantId: "tenant-1",
    registrationId: "reg-1",
    amount: "1000",
    currency: "IRR"
  });
  assert.equal(payment.id, "pay-new");
});

test("createManualPayment rejects unknown registration", async () => {
  const service = new ManualPaymentService(
    {
      runInTenantScope: async (_tenantId, fn) =>
        fn({
          findOne: async () => null
        } as never)
    } as never,
    {} as never,
    { invalidateSummaryCache: async () => undefined } as never
  );

  await assert.rejects(
    () =>
      service.createManualPayment({
        tenantId: "tenant-1",
        registrationId: "missing",
        amount: "1000",
        currency: "IRR"
      }),
    (err: unknown) => err instanceof NotFoundException
  );
});
