import assert from "node:assert/strict";
import test from "node:test";
import { ConflictException } from "@nestjs/common";
import { RegistrationsController } from "../../src/modules/registrations/registrations.controller";
import {
  RegistrationPaymentStatus,
  RegistrationStatus
} from "../../src/modules/registrations/registration.entity";
import { WaitlistItemStatus } from "../../src/modules/registrations/waitlist-item.entity";
import { IdempotencyService } from "../../src/modules/idempotency/idempotency.service";

function createControllerFixture() {
  const responses = new Map<string, { requestHash: string; body: Record<string, unknown> }>();
  const executionCount = {
    payment: 0,
    convert: 0,
    cancel: 0
  };

  const registrationsService = {
    async createPublicRegistrationOrWaitlist() {
      throw new Error("not used");
    },
    async updateRegistrationPayment(registrationId: string, payload: unknown) {
      executionCount.payment += 1;
      return {
        id: registrationId,
        status: RegistrationStatus.PENDING,
        paymentStatus: (payload as { paymentStatus: string }).paymentStatus,
        paidAmount: "1200"
      };
    },
    async convertWaitlistItem(waitlistItemId: string, payload: unknown) {
      executionCount.convert += 1;
      return {
        id: waitlistItemId,
        status: WaitlistItemStatus.CONVERTED,
        conversionReason: (payload as { conversionReason?: string }).conversionReason ?? null
      };
    },
    async cancelWaitlistItem(waitlistItemId: string, payload: unknown) {
      executionCount.cancel += 1;
      return {
        id: waitlistItemId,
        status: WaitlistItemStatus.CANCELLED,
        cancelReason: (payload as { cancelReason?: string }).cancelReason ?? null
      };
    }
  };

  const idempotencyService = {
    createRequestHash(input: { method: string; path: string; body: unknown }) {
      return JSON.stringify(input);
    },
    async executeWithIdempotency(
      params: {
        tenantId: string;
        key: string;
        requestHash: string;
        statusCode?: number;
      },
      handler: () => Promise<Record<string, unknown>>
    ) {
      const existing = responses.get(params.key);
      if (existing) {
        if (existing.requestHash !== params.requestHash) {
          throw new ConflictException({
            error: {
              code: "IDEMPOTENCY_KEY_REPLAY_MISMATCH",
              message: "Idempotency key already used with a different payload"
            }
          });
        }
        return {
          statusCode: 200,
          responseBody: existing.body,
          replayed: true
        };
      }
      const body = await handler();
      responses.set(params.key, { requestHash: params.requestHash, body });
      return {
        statusCode: params.statusCode ?? 200,
        responseBody: body,
        replayed: false
      };
    }
  };

  const controller = new RegistrationsController(
    registrationsService as never,
    {} as never,
    idempotencyService as unknown as IdempotencyService,
    {
      getTenantId: () => "tenant-1"
    } as never
  );

  return { controller, executionCount };
}

test("updateRegistrationPayment retries with same idempotency key are replay-safe", async () => {
  const { controller, executionCount } = createControllerFixture();
  const payload = {
    paymentStatus: RegistrationPaymentStatus.PAID,
    paidAmount: 1200
  };

  const first = await controller.updateRegistrationPayment("reg-1", payload, "idem-payment-1");
  const second = await controller.updateRegistrationPayment("reg-1", payload, "idem-payment-1");

  assert.equal(first.id, "reg-1");
  assert.deepEqual(second, first);
  assert.equal(executionCount.payment, 1);
});

test("convertWaitlistItem retry returns stored response and executes once", async () => {
  const { controller, executionCount } = createControllerFixture();
  const payload = { conversionReason: "manual_override" };

  const first = await controller.convertWaitlistItem("wait-1", payload, "idem-convert-1");
  const second = await controller.convertWaitlistItem("wait-1", payload, "idem-convert-1");

  assert.equal(first.status, WaitlistItemStatus.CONVERTED);
  assert.deepEqual(second, first);
  assert.equal(executionCount.convert, 1);
});

test("cancelWaitlistItem retry returns stored response and executes once", async () => {
  const { controller, executionCount } = createControllerFixture();
  const payload = { cancelReason: "participant_requested" };

  const first = await controller.cancelWaitlistItem("wait-2", payload, "idem-cancel-1");
  const second = await controller.cancelWaitlistItem("wait-2", payload, "idem-cancel-1");

  assert.equal(first.status, WaitlistItemStatus.CANCELLED);
  assert.deepEqual(second, first);
  assert.equal(executionCount.cancel, 1);
});

test("same idempotency key with different payload returns replay mismatch", async () => {
  const { controller } = createControllerFixture();

  await controller.convertWaitlistItem(
    "wait-3",
    { conversionReason: "capacity_available" },
    "idem-mismatch-1"
  );

  await assert.rejects(
    () =>
      controller.convertWaitlistItem(
        "wait-3",
        { conversionReason: "manual_override" },
        "idem-mismatch-1"
      ),
    (error: unknown) =>
      error instanceof ConflictException &&
      (error.getResponse() as { error?: { code?: string } }).error?.code ===
        "IDEMPOTENCY_KEY_REPLAY_MISMATCH"
  );
});
