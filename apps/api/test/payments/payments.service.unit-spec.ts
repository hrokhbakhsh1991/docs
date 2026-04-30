import assert from "node:assert/strict";
import test from "node:test";
import type { DataSource } from "typeorm";
import { OutboxService } from "../../src/modules/outbox/outbox.service";
import {
  RegistrationEntity,
  RegistrationStatus
} from "../../src/modules/registrations/registration.entity";
import { RegistrationsService } from "../../src/modules/registrations/registrations.service";
import { PaymentStatus } from "../../src/modules/payments/entities/payment.entity";
import { PaymentsService } from "../../src/modules/payments/payments.service";

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
    status: RegistrationStatus.ACCEPTED
  } as RegistrationEntity;

  const manager = {
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

  const registrationsService = {
    async transitionRegistrationForPayment(
      _m: unknown,
      reg: RegistrationEntity,
      target: RegistrationStatus
    ) {
      reg.status = target;
      return reg;
    }
  } as unknown as RegistrationsService;

  const outboxService = {
    async addEvent(
      _m: unknown,
      event: { eventType: string }
    ): Promise<void> {
      outboxEvents.push(event.eventType);
    }
  } as unknown as OutboxService;

  const service = new PaymentsService(
    {} as never,
    dataSource,
    outboxService,
    registrationsService
  );

  await service.processWebhook({
    providerPaymentId: "provider-1",
    status: PaymentStatus.PAID
  });

  assert.equal(registration.status, RegistrationStatus.ACCEPTED_PAID);
  assert.equal(outboxEvents.includes("payment.succeeded"), true);
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
    status: RegistrationStatus.ACCEPTED
  } as RegistrationEntity;
  const manager = {
    getRepository() {
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
    }
  };
  const dataSource = {
    async transaction<T>(fn: (m: typeof manager) => Promise<T>): Promise<T> {
      return fn(manager);
    }
  } as unknown as DataSource;
  const registrationsService = {
    async transitionRegistrationForPayment(
      _m: unknown,
      reg: RegistrationEntity,
      target: RegistrationStatus
    ) {
      reg.status = target;
      return reg;
    }
  } as unknown as RegistrationsService;
  const outboxService = {
    async addEvent(): Promise<void> {}
  } as unknown as OutboxService;

  const service = new PaymentsService(
    {} as never,
    dataSource,
    outboxService,
    registrationsService
  );

  const timedOut = await service.failTimedOutPendingPayments();
  const snapshot = service.getMetricsSnapshot();
  assert.equal(timedOut, 1);
  assert.equal(snapshot.timedOutPayments, 1);
  assert.equal(snapshot.failedPayments, 1);
  assert.equal(snapshot.autoRecoveredCapacityCount, 1);
});
