import assert from "node:assert/strict";
import test from "node:test";
import type { DataSource } from "typeorm";
import { TenantContextMissingError } from "../../src/common/errors/tenant-context-missing.error";
import { OutboxService } from "../../src/modules/outbox/outbox.service";
import {
  RegistrationEntity,
  RegistrationStatus
} from "../../src/modules/registrations/registration.entity";
import { WaitlistItemEntity } from "../../src/modules/registrations/waitlist-item.entity";
import { PaymentEntity, PaymentStatus } from "../../src/modules/payments/entities/payment.entity";
import { PaymentsService } from "../../src/modules/payments/payments.service";
import { BookingPriceSnapshotEntity } from "../../src/modules/pricing/entities/booking-price-snapshot.entity";
import { noopPaymentRefundLedgerForTests } from "../helpers/noop-payment-refund-ledger.service";
import { noopPaymentGatewayFactoryForTests } from "../helpers/noop-payment-gateway-factory";
import { TourEntity } from "../../src/modules/tours/entities/tour.entity";

const noopRegistrationPaymentPort = {
  async promoteNextWaitlistItemForPaymentFlow(): Promise<boolean> {
    return false;
  },
  async transitionRegistrationForPayment(
    _manager: unknown,
    registration: RegistrationEntity,
    targetStatus: RegistrationStatus
  ): Promise<RegistrationEntity> {
    registration.status = targetStatus;
    return registration;
  }
};

/**
 * Stubs `EntityManager.exists` for tests that exercise booking finalization / payment capture.
 */
function stubExistsDefaultPipeline(input: {
  registrationId: string;
  tenantId: string;
  hasPriceSnapshot?: boolean;
  hasPendingPayment?: boolean;
  hasPaidPayment?: boolean;
}) {
  const {
    registrationId,
    tenantId,
    hasPriceSnapshot = true,
    hasPendingPayment = true,
    hasPaidPayment = false
  } = input;
  return async (entity: unknown, opts: { where: Record<string, unknown> }) => {
    const w = opts.where;
    if (entity === BookingPriceSnapshotEntity) {
      return hasPriceSnapshot;
    }
    if (entity === PaymentEntity) {
      if (w.registrationId !== registrationId || w.tenantId !== tenantId) {
        return false;
      }
      if (w.status === PaymentStatus.PENDING) {
        if (Object.prototype.hasOwnProperty.call(w, "id")) {
          return false;
        }
        return hasPendingPayment;
      }
      if (w.status === PaymentStatus.PAID) {
        return hasPaidPayment;
      }
    }
    return false;
  };
}

function stubTourRepositoryForPaymentsLock() {
  return {
    createQueryBuilder() {
      return {
        setLock() {
          return this;
        },
        where() {
          return this;
        },
        andWhere() {
          return this;
        },
        async getOne() {
          return {
            id: "tour-1",
            tenantId: "tenant-1",
            totalCapacity: 10,
            acceptedCount: 0
          } as TourEntity;
        }
      };
    }
  };
}

test("webhook paid transitions registration to AcceptedPaid and emits payment.succeeded", async () => {
  const outboxEvents: string[] = [];
  const paymentRow = {
    id: "pay-1",
    tenantId: "tenant-1",
    registrationId: "reg-1",
    status: PaymentStatus.PENDING,
    providerPaymentId: "provider-1"
  };
  const registration = {
    id: "reg-1",
    tenantId: "tenant-1",
    tourId: "tour-1",
    tourDepartureId: "tour-1",
    status: RegistrationStatus.ACCEPTED
  } as RegistrationEntity;

  const manager = {
    getRepository(entity: unknown) {
      if ((entity as { name?: string }).name === TourEntity.name) {
        return stubTourRepositoryForPaymentsLock();
      }
      throw new Error("unexpected repository");
    },
    exists: stubExistsDefaultPipeline({
      registrationId: "reg-1",
      tenantId: "tenant-1",
      hasPriceSnapshot: true,
      hasPendingPayment: true,
      hasPaidPayment: false
    }),
    async findOne(entity: unknown, opts: { where: Record<string, unknown> }) {
      const name = (entity as { name?: string }).name;
      if (name === "PaymentEntity") {
        return opts.where.providerPaymentId === "provider-1" ? paymentRow : null;
      }
      return registration;
    },
    async save(entity: unknown) {
      return entity;
    }
  };

  const dataSource = {
    async transaction<T>(fn: (m: typeof manager) => Promise<T>): Promise<T> {
      return fn(manager);
    }
  } as unknown as DataSource;

  const outboxService = {
    async addEvent(
      _m: unknown,
      event: { eventType: string }
    ): Promise<void> {
      outboxEvents.push(event.eventType);
    }
  } as unknown as OutboxService;

  const service = new PaymentsService(
    {
      async findOne(opts: { where: { providerPaymentId?: string } }) {
        return opts.where.providerPaymentId === "provider-1" ? paymentRow : null;
      }
    } as never,
    {} as never,
    {} as never,
    dataSource,
    { setTenantId: () => undefined } as never,
    { runInTenantScope: async () => undefined } as never,
    {
      createRequestHash: () => "h",
      async executeWithIdempotency(
        _params: unknown,
        handler: () => Promise<Record<string, unknown>>
      ) {
        return {
          statusCode: 200,
          replayed: false,
          responseBody: await handler()
        };
      }
    } as never,
    outboxService,
    {} as never,
    noopPaymentRefundLedgerForTests,
    noopPaymentGatewayFactoryForTests,
    noopRegistrationPaymentPort,
    { invalidateSummaryCache: async () => undefined } as never
  );

  await service.processWebhook({
    tenant_id: "tenant-1",
    providerPaymentId: "provider-1",
    status: PaymentStatus.PAID
  });

  assert.equal(registration.status, RegistrationStatus.ACCEPTED_PAID);
  assert.equal(outboxEvents.includes("payment.succeeded"), true);
  assert.equal(outboxEvents.includes("booking.finalization.payment_captured"), true);
  assert.equal(outboxEvents.includes("booking.finalization.booking_confirmed"), true);
});

test("timeout processor fails stale pending payments and updates metrics", async () => {
  const stale = {
    id: "pay-2",
    tenantId: "tenant-1",
    registrationId: "reg-2",
    status: PaymentStatus.PENDING,
    createdAt: new Date(Date.now() - 20 * 60_000),
    providerPaymentId: "provider-2"
  };
  const registration = {
    id: "reg-2",
    tenantId: "tenant-1",
    tourId: "tour-1",
    tourDepartureId: "tour-1",
    status: RegistrationStatus.ACCEPTED
  } as RegistrationEntity;
  const manager = {
    getRepository(entity: unknown) {
      const name = (entity as { name?: string }).name;
      if (name === TourEntity.name) {
        return stubTourRepositoryForPaymentsLock();
      }
      if (name === WaitlistItemEntity.name) {
        return {
          createQueryBuilder() {
            return {
              where() {
                return this;
              },
              andWhere() {
                return this;
              },
              orderBy() {
                return this;
              },
              setLock() {
                return this;
              },
              setOnLocked() {
                return this;
              },
              async getOne() {
                return null;
              }
            };
          }
        };
      }
      return {
        createQueryBuilder() {
          return {
            where() {
              return this;
            },
            andWhere() {
              return this;
            },
            orderBy() {
              return this;
            },
            take() {
              return this;
            },
            setLock() {
              return this;
            },
            setOnLocked() {
              return this;
            },
            async getMany() {
              return [stale];
            }
          };
        }
      };
    },
    async findOne(entity: unknown) {
      return (entity as { name?: string }).name === "RegistrationEntity"
        ? registration
        : stale;
    },
    async save(entity: unknown) {
      return entity;
    },
    exists: stubExistsDefaultPipeline({
      registrationId: "reg-2",
      tenantId: "tenant-1",
      hasPriceSnapshot: true,
      hasPendingPayment: true,
      hasPaidPayment: false
    })
  };
  const dataSource = {
    async transaction<T>(fn: (m: typeof manager) => Promise<T>): Promise<T> {
      return fn(manager);
    }
  } as unknown as DataSource;
  const outboxService = {
    async addEvent(): Promise<void> {}
  } as unknown as OutboxService;

  const service = new PaymentsService(
    {} as never,
    {} as never,
    {
      async find() {
        return [{ id: "tenant-1" }];
      }
    } as never,
    dataSource,
    { setTenantId: () => undefined } as never,
    {
      runInTenantScope: async (_tenantId: string, fn: (m: typeof manager) => Promise<void>) =>
        fn(manager)
    } as never,
    {} as never,
    outboxService,
    {} as never,
    noopPaymentRefundLedgerForTests,
    noopPaymentGatewayFactoryForTests,
    noopRegistrationPaymentPort,
    { invalidateSummaryCache: async () => undefined } as never
  );

  const timedOut = await service.failTimedOutPendingPayments();
  const snapshot = service.getMetricsSnapshot();
  assert.equal(timedOut, 1);
  assert.equal(snapshot.timedOutPayments, 1);
  assert.equal(snapshot.failedPayments, 1);
  assert.equal(snapshot.autoRecoveredCapacityCount, 1);
});

test("webhook duplicate provider_event_id increments deduped metric", async () => {
  const paymentRow = {
    id: "pay-9",
    tenantId: "tenant-1",
    registrationId: "reg-9",
    status: PaymentStatus.PENDING,
    providerPaymentId: "provider-9",
    provider: "mock_provider"
  };
  const registration = {
    id: "reg-9",
    tenantId: "tenant-1",
    tourId: "tour-1",
    tourDepartureId: "tour-1",
    status: RegistrationStatus.ACCEPTED
  } as RegistrationEntity;

  const manager = {
    getRepository(entity: unknown) {
      if ((entity as { name?: string }).name === TourEntity.name) {
        return stubTourRepositoryForPaymentsLock();
      }
      throw new Error("unexpected repository");
    },
    exists: stubExistsDefaultPipeline({
      registrationId: "reg-9",
      tenantId: "tenant-1",
      hasPriceSnapshot: true,
      hasPendingPayment: true,
      hasPaidPayment: false
    }),
    async findOne(entity: unknown, opts: { where: Record<string, unknown> }) {
      const name = (entity as { name?: string }).name;
      if (name === "PaymentEntity") {
        return opts.where.providerPaymentId === "provider-9" ? paymentRow : null;
      }
      return registration;
    },
    async save(entity: unknown) {
      return entity;
    }
  };

  const dataSource = {
    async transaction<T>(fn: (m: typeof manager) => Promise<T>): Promise<T> {
      return fn(manager);
    }
  } as unknown as DataSource;

  const idempotencyService = {
    createRequestHash: () => "h",
    replayed: false,
    async executeWithIdempotency(
      _params: unknown,
      handler: () => Promise<Record<string, unknown>>
    ) {
      if (this.replayed) {
        return {
          statusCode: 200,
          replayed: true,
          responseBody: {
            providerPaymentId: "provider-9",
            providerEventId: "evt-1",
            provider: "mock_provider",
            tenantId: "tenant-1",
            status: PaymentStatus.PAID
          }
        };
      }
      const body = await handler();
      this.replayed = true;
      return {
        statusCode: 200,
        replayed: false,
        responseBody: body
      };
    }
  };

  const outboxService = {
    async addEvent(): Promise<void> {}
  } as unknown as OutboxService;

  const service = new PaymentsService(
    {
      async findOne(opts: { where: { providerPaymentId?: string } }) {
        return opts.where.providerPaymentId === "provider-9" ? paymentRow : null;
      }
    } as never,
    {} as never,
    {} as never,
    dataSource,
    { setTenantId: () => undefined } as never,
    { runInTenantScope: async () => undefined } as never,
    idempotencyService as never,
    outboxService,
    {} as never,
    noopPaymentRefundLedgerForTests,
    noopPaymentGatewayFactoryForTests,
    noopRegistrationPaymentPort,
    { invalidateSummaryCache: async () => undefined } as never
  );

  const first = await service.processWebhook({
    tenant_id: "tenant-1",
    providerEventId: "evt-1",
    providerPaymentId: "provider-9",
    status: PaymentStatus.PAID
  });
  const second = await service.processWebhook({
    tenant_id: "tenant-1",
    providerEventId: "evt-1",
    providerPaymentId: "provider-9",
    status: PaymentStatus.PAID
  });

  const snapshot = service.getMetricsSnapshot();
  assert.equal(first.deduplicated, false);
  assert.equal(second.deduplicated, true);
  assert.equal(snapshot.webhookReceivedTotal, 2);
  assert.equal(snapshot.webhookProcessedTotal, 2);
  assert.equal(snapshot.webhookDedupedTotal, 1);
});

test("admin payment list is tenant scoped", async () => {
  const rows = [
    {
      id: "pay-a",
      tenantId: "tenant-a",
      registrationId: "reg-a",
      amount: "100",
      currency: "USD",
      provider: "mock",
      providerPaymentId: "pp-a",
      status: PaymentStatus.PAID,
      paidAt: null,
      failedAt: null,
      refundedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null
    },
    {
      id: "pay-b",
      tenantId: "tenant-b",
      registrationId: "reg-b",
      amount: "200",
      currency: "USD",
      provider: "mock",
      providerPaymentId: "pp-b",
      status: PaymentStatus.PAID,
      paidAt: null,
      failedAt: null,
      refundedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null
    }
  ];
  let capturedTenantId: string | undefined;
  const paymentRepository = {
    async find(opts: { where: { tenantId: string } }) {
      capturedTenantId = opts.where.tenantId;
      return rows.filter((row) => row.tenantId === opts.where.tenantId);
    }
  };

  const service = new PaymentsService(
    paymentRepository as never,
    {} as never,
    {} as never,
    {} as DataSource,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    noopPaymentRefundLedgerForTests,
    noopPaymentGatewayFactoryForTests,
    noopRegistrationPaymentPort,
    { invalidateSummaryCache: async () => undefined } as never
  );

  const result = await service.listPayments("TENANT-A");
  assert.equal(capturedTenantId, "tenant-a");
  assert.equal(result.length, 1);
  assert.equal(result[0]?.tenantId, "tenant-a");
});

test("admin payment list fails when tenant context is missing", async () => {
  const service = new PaymentsService(
    {
      async find() {
        return [];
      }
    } as never,
    {} as never,
    {} as never,
    {} as DataSource,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    noopPaymentRefundLedgerForTests,
    noopPaymentGatewayFactoryForTests,
    noopRegistrationPaymentPort,
    { invalidateSummaryCache: async () => undefined } as never
  );

  await assert.rejects(
    () => service.listPayments("   "),
    (error) => error instanceof TenantContextMissingError
  );
});
