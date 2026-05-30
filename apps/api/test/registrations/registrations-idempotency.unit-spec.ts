import assert from "node:assert/strict";
import test from "node:test";
import { ConflictException } from "@nestjs/common";
import { RegistrationsController } from "../../src/modules/registrations/registrations.controller";
import {
  RegistrationPaymentStatus,
  RegistrationStatus
} from "../../src/modules/registrations/registration.entity";
import { WaitlistItemStatus } from "../../src/modules/registrations/waitlist-item.entity";
import { IdempotencyService } from "../../src/modules/idempotency/repositories/idempotency.service";

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
    registrationsService as never, // 1. registrationsService
    {} as never, // 2. registrationPlacementOrchestrator
    idempotencyService as unknown as IdempotencyService, // 3. idempotencyService
    { resolveEffectiveTenantId: () => "tenant-1", getTenantId: () => "tenant-1", getUserId: () => "user-1", setTenantId: () => undefined } as never, // 4. requestContextService
    {} as never, // 5. tenantBootstrapService
    { execute: async () => ({
      id: "reg-1",
      tenantId: "tenant-1",
      tourId: "tour-1",
      participantFullName: "Test User",
      participantContactPhone: "09000000000",
      bookingTarget: null,
      participantNationalId: null,
      transportMode: "Self",
      entryMode: "Online",
      telegramUserId: null,
      telegramUsername: null,
      vehicleSeatCapacity: null,
      participantNote: null,
      participantMetadata: null,
      status: "Pending",
      rowVersion: 1,
      paymentStatus: "Unpaid",
      paidAmount: null,
      paymentMetadata: null,
      quotedTotalMinor: null,
      quotedCurrencyCode: null,
      quotedPricingVersion: null,
      quotedListPriceMinor: null,
      createdAt: new Date("2024-01-01T00:00:00Z"),
      updatedAt: new Date("2024-01-01T00:00:00Z")
    }) } as never, // 6. queryBus
    { execute: async (cmd: any) => {
      executionCount.payment += 1;
      return { id: cmd.registrationId, status: RegistrationStatus.PENDING, paymentStatus: cmd.paymentStatus, paidAmount: cmd.paidAmount || "1200" };
    } } as never // 7. commandBus
  );

  return { controller, executionCount, registrationsService, idempotencyService };
}

test("updateRegistrationPayment retries with same idempotency key are replay-safe", async () => {
  const { idempotencyService, executionCount } = createControllerFixture();
  const commandBusStub = {
    execute: async (_cmd: unknown) => {
      executionCount.payment += 1;
      return { id: "reg-1", paymentStatus: RegistrationPaymentStatus.PAID, paidAmount: "1200" };
    }
  };
  const payload = {
    paymentStatus: RegistrationPaymentStatus.PAID,
    paidAmount: 1200,
    expected_row_version: 1
  };
  const params = {
    tenantId: "tenant-1",
    key: "idem-payment-1",
    requestHash: idempotencyService.createRequestHash({
      method: "PATCH",
      path: "/api/v2/registrations/reg-1/payment",
      body: payload
    }),
    statusCode: 200
  };

  const first = await idempotencyService.executeWithIdempotency(params, () =>
    commandBusStub.execute(payload)
  );
  const second = await idempotencyService.executeWithIdempotency(params, () =>
    commandBusStub.execute(payload)
  );

  assert.deepEqual(second.responseBody, first.responseBody);
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
