import assert from "node:assert/strict";
import test from "node:test";
import { ForbiddenException } from "@nestjs/common";
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
import { bookingLedgerAccountId } from "@repo/shared-contracts";
import {
  paymentEntityContractFixture,
  TEST_PAYMENT_ID_2,
  TEST_REGISTRATION_ID,
  TEST_REGISTRATION_ID_2,
  TEST_TENANT_ID,
  TEST_TOUR_ID,
} from "../helpers/finance-contract-fixtures";

const noopRegistrationPaymentPort = {
  async lockTourRowForUpdate(): Promise<TourEntity> {
    return { id: "tour-1" } as TourEntity;
  },
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

function paymentPortFromPipeline(input: {
  registrationId: string;
  tenantId: string;
  hasPriceSnapshot?: boolean;
  hasPendingPayment?: boolean;
  hasPaidPayment?: boolean;
}) {
  const exists = stubExistsDefaultPipeline(input);
  return {
    async existsPendingForRegistration(_manager: unknown, registrationId: string, tenantId: string) {
      return exists(PaymentEntity, {
        where: { registrationId, tenantId, status: PaymentStatus.PENDING }
      });
    },
    async existsPaidForRegistration(_manager: unknown, registrationId: string, tenantId: string) {
      return exists(PaymentEntity, {
        where: { registrationId, tenantId, status: PaymentStatus.PAID }
      });
    },
    async existsOtherPendingForRegistration() {
      return false;
    },
    async savePayment(_manager: unknown, payment: unknown) {
      return payment;
    }
  };
}

function captureLedgerDeps() {
  return [
    noopPaymentRefundLedgerForTests,
    {
      emitPaymentCaptureAtPaid: async () => ({
        lines: [
          {
            id: "d1",
            journalId: "j1",
            tenantId: TEST_TENANT_ID,
            account: "gl:leader-registration-payment-clearing",
            side: "debit",
            amount_minor: "100",
            currency: "USD",
            correlationId: "c1",
            idempotencyKey: "k1",
            createdAt: new Date().toISOString()
          },
          {
            id: "c1",
            journalId: "j1",
            tenantId: TEST_TENANT_ID,
            account: bookingLedgerAccountId(TEST_REGISTRATION_ID),
            side: "credit",
            amount_minor: "100",
            currency: "USD",
            correlationId: "c2",
            idempotencyKey: "k2",
            createdAt: new Date().toISOString()
          }
        ]
      })
    } as never,
    noopPaymentGatewayFactoryForTests,
    noopRegistrationPaymentPort,
    { invalidateSummaryCache: async () => undefined } as never
  ] as const;
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
            id: TEST_TOUR_ID,
            tenantId: TEST_TENANT_ID,
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
  const paymentRow = paymentEntityContractFixture({
    providerPaymentId: "provider-1",
  });
  const registration = {
    id: TEST_REGISTRATION_ID,
    tenantId: TEST_TENANT_ID,
    tourId: TEST_TOUR_ID,
    tourDepartureId: TEST_TOUR_ID,
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
      registrationId: TEST_REGISTRATION_ID,
      tenantId: TEST_TENANT_ID,
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
    async transaction<T>(fn: (_m: typeof manager) => Promise<T>): Promise<T> {
      return fn(manager);
    }
  };

  const outboxService = {
    async addEvent(
      _m: unknown,
      event: { eventType: string }
    ): Promise<void> {
      outboxEvents.push(event.eventType);
    }
  } as unknown as OutboxService;

  const ledgerDeps = captureLedgerDeps();
  const service = new PaymentsService(
    {
      async findByProviderPaymentId(providerPaymentId: string) {
        return providerPaymentId === "provider-1" ? paymentRow : null;
      },
      async runInTransaction<T>(fn: (_m: typeof manager) => Promise<T>) {
        return dataSource.transaction(fn);
      },
      async findByProviderPaymentIdWithManager(_m: unknown, providerPaymentId: string) {
        return providerPaymentId === "provider-1" ? paymentRow : null;
      },
      ...paymentPortFromPipeline({
        registrationId: TEST_REGISTRATION_ID,
        tenantId: TEST_TENANT_ID,
        hasPriceSnapshot: true,
        hasPendingPayment: true,
        hasPaidPayment: false
      })
    } as never,
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
    ledgerDeps[0],
    ledgerDeps[1],
    ledgerDeps[2],
    ledgerDeps[3],
    ledgerDeps[4]
  );

  await service.processWebhook({
    tenant_id: TEST_TENANT_ID,
    providerPaymentId: "provider-1",
    status: PaymentStatus.PAID
  });

  assert.equal(registration.status, RegistrationStatus.ACCEPTED_PAID);
  assert.equal(outboxEvents.includes("payment.succeeded"), true);
  assert.equal(outboxEvents.includes("booking.finalization.payment_captured"), true);
  assert.equal(outboxEvents.includes("booking.finalization.booking_confirmed"), true);
});

test("timeout processor fails stale pending payments and updates metrics", async () => {
  const stale = paymentEntityContractFixture({
    id: TEST_PAYMENT_ID_2,
    registrationId: TEST_REGISTRATION_ID_2,
    status: PaymentStatus.PENDING,
    createdAt: new Date(Date.now() - 20 * 60_000),
    providerPaymentId: "provider-2",
  });
  const registration = {
    id: TEST_REGISTRATION_ID_2,
    tenantId: TEST_TENANT_ID,
    tourId: TEST_TOUR_ID,
    tourDepartureId: TEST_TOUR_ID,
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
      registrationId: TEST_REGISTRATION_ID_2,
      tenantId: TEST_TENANT_ID,
      hasPriceSnapshot: true,
      hasPendingPayment: true,
      hasPaidPayment: false
    })
  };
  const outboxService = {
    async addEvent(): Promise<void> {}
  } as unknown as OutboxService;

  const ledgerDeps = captureLedgerDeps();
  const service = new PaymentsService(
    {
      async listActiveTenantIds() {
        return [TEST_TENANT_ID];
      },
      async findLockedTimedOutPending(_manager: unknown) {
        return [stale];
      },
      ...paymentPortFromPipeline({
        registrationId: TEST_REGISTRATION_ID_2,
        tenantId: TEST_TENANT_ID,
        hasPriceSnapshot: true,
        hasPendingPayment: true,
        hasPaidPayment: false
      })
    } as never,
    { setTenantId: () => undefined } as never,
    {
      runInTenantScope: async (_tenantId: string, fn: (_m: typeof manager) => Promise<void>) =>
        fn(manager)
    } as never,
    {} as never,
    outboxService,
    {} as never,
    ledgerDeps[0],
    ledgerDeps[1],
    ledgerDeps[2],
    ledgerDeps[3],
    ledgerDeps[4]
  );

  const timedOut = await service.failTimedOutPendingPayments();
  const snapshot = service.getMetricsSnapshot();
  assert.equal(timedOut, 1);
  assert.equal(snapshot.timedOutPayments, 1);
  assert.equal(snapshot.failedPayments, 1);
  assert.equal(snapshot.autoRecoveredCapacityCount, 1);
});

test("webhook duplicate provider_event_id increments deduped metric", async () => {
  const paymentRow = paymentEntityContractFixture({
    id: TEST_PAYMENT_ID_2,
    registrationId: TEST_REGISTRATION_ID_2,
    providerPaymentId: "provider-9",
    provider: "mock_provider",
  });
  const registration = {
    id: TEST_REGISTRATION_ID_2,
    tenantId: TEST_TENANT_ID,
    tourId: TEST_TOUR_ID,
    tourDepartureId: TEST_TOUR_ID,
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
      registrationId: TEST_REGISTRATION_ID_2,
      tenantId: TEST_TENANT_ID,
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
    async transaction<T>(fn: (_m: typeof manager) => Promise<T>): Promise<T> {
      return fn(manager);
    }
  };

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
            tenantId: TEST_TENANT_ID,
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

  const ledgerDeps = captureLedgerDeps();
  const service = new PaymentsService(
    {
      async findByProviderPaymentId(providerPaymentId: string) {
        return providerPaymentId === "provider-9" ? paymentRow : null;
      },
      async runInTransaction<T>(fn: (_m: typeof manager) => Promise<T>) {
        return dataSource.transaction(fn);
      },
      async findByProviderPaymentIdWithManager(_m: unknown, providerPaymentId: string) {
        return providerPaymentId === "provider-9" ? paymentRow : null;
      },
      ...paymentPortFromPipeline({
        registrationId: TEST_REGISTRATION_ID_2,
        tenantId: TEST_TENANT_ID,
        hasPriceSnapshot: true,
        hasPendingPayment: true,
        hasPaidPayment: false
      })
    } as never,
    { setTenantId: () => undefined } as never,
    { runInTenantScope: async () => undefined } as never,
    idempotencyService as never,
    outboxService,
    {} as never,
    ledgerDeps[0],
    ledgerDeps[1],
    ledgerDeps[2],
    ledgerDeps[3],
    ledgerDeps[4]
  );

  const first = await service.processWebhook({
    tenant_id: TEST_TENANT_ID,
    providerEventId: "evt-1",
    providerPaymentId: "provider-9",
    status: PaymentStatus.PAID
  });
  const second = await service.processWebhook({
    tenant_id: TEST_TENANT_ID,
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
    async listByTenant(tenantId: string) {
      capturedTenantId = tenantId;
      return rows.filter((row) => row.tenantId === tenantId);
    }
  };

  const ledgerDeps = captureLedgerDeps();
  const service = new PaymentsService(
    paymentRepository as never,
    { resolveEffectiveTenantId: () => "TENANT-A" } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    ledgerDeps[0],
    ledgerDeps[1],
    ledgerDeps[2],
    ledgerDeps[3],
    ledgerDeps[4]
  );

  const result = await service.listPayments();
  assert.equal(capturedTenantId, "tenant-a");
  assert.equal(result.length, 1);
  assert.equal(result[0]?.tenantId, "tenant-a");
});

test("admin payment list fails when tenant context is missing", async () => {
  const ledgerDeps = captureLedgerDeps();
  const service = new PaymentsService(
    {
      async listByTenant() {
        return [];
      }
    } as never,
    { resolveEffectiveTenantId: () => "   " } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    ledgerDeps[0],
    ledgerDeps[1],
    ledgerDeps[2],
    ledgerDeps[3],
    ledgerDeps[4]
  );

  await assert.rejects(
    () => service.listPayments(),
    (error) => error instanceof ForbiddenException
  );
});
