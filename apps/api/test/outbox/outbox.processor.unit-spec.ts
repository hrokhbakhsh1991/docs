import assert from "node:assert/strict";
import test from "node:test";
import { OutboxProcessor } from "../../src/modules/outbox/outbox.processor";
import { OutboxMetricsService } from "../../src/modules/outbox/outbox-metrics.service";
import {
  OutboxEventEntity,
  OutboxEventStatus
} from "../../src/modules/outbox/entities/outbox-event.entity";
import {
  RegistrationEntity,
  RegistrationPaymentStatus,
  RegistrationStatus
} from "../../src/modules/registrations/registration.entity";
import { TourEntity } from "../../src/modules/tours/entities/tour.entity";

function buildPendingRow(id: string): OutboxEventEntity {
  const row = new OutboxEventEntity();
  row.id = id;
  row.tenantId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  row.aggregateType = "Registration";
  row.aggregateId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  row.eventType = "registration.accepted";
  row.payload = {};
  row.status = OutboxEventStatus.PENDING;
  row.retryCount = 0;
  row.nextRetryAt = null;
  row.createdAt = new Date();
  row.processedAt = null;
  return row;
}

test("processor marks row DELIVERED after successful publish", async () => {
  const row = buildPendingRow("11111111-1111-4111-8111-111111111111");
  const saved: OutboxEventEntity[] = [];

  const qb = {
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
      return [row];
    }
  };

  const manager = {
    async count() {
      return 5;
    },
    async query() {
      return [];
    },
    async findOne() {
      return row;
    },
    createQueryBuilder() {
      return qb;
    },
    async save(entity: OutboxEventEntity) {
      saved.push(entity);
      return entity;
    }
  };

  const dataSource = {
    async transaction<T>(fn: (_m: typeof manager) => Promise<T>): Promise<T> {
      return fn(manager);
    }
  };

  let deliveries = 0;
  const auditService = {
    deliverFromOutbox(): void {
      deliveries += 1;
    }
  };

  const emailService = {
    async sendVerificationEmailOutboundStrict(): Promise<void> {}
  };

  const configService = {
    getOutboxProcessorEnabled(): boolean {
      return true;
    },
    getOutboxPollIntervalMs(): number {
      return 5000;
    },
    getOutboxMaxRetry(): number {
      return 5;
    },
    getOutboxBatchSize(): number {
      return 50;
    }
  };

  const metrics = new OutboxMetricsService();
  const processor = new OutboxProcessor(
    dataSource as never,
    auditService as never,
    emailService as never,
    configService as never,
    metrics,
    {
      runInTenantScope: async (_tenantId: string, fn: (_m: typeof manager) => Promise<void>) =>
        fn(manager)
    } as never
  );

  await processor.processBatch();

  assert.equal(deliveries, 1);
  assert.equal(saved.length, 1);
  assert.equal(saved[0]?.status, OutboxEventStatus.DELIVERED);
  assert.equal(saved[0]?.processedAt instanceof Date, true);
});

test("processor increments retryCount when publish fails", async () => {
  const row = buildPendingRow("22222222-2222-4222-8222-222222222222");
  const saved: OutboxEventEntity[] = [];

  const qb = {
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
      return [row];
    }
  };

  const manager = {
    async count() {
      return 1;
    },
    async query() {
      return [];
    },
    createQueryBuilder() {
      return qb;
    },
    async findOne() {
      return row;
    },
    async save(entity: OutboxEventEntity) {
      saved.push(entity);
      return entity;
    }
  };

  const dataSource = {
    async transaction<T>(fn: (_m: typeof manager) => Promise<T>): Promise<T> {
      return fn(manager);
    }
  };

  const auditService = {
    deliverFromOutbox(): void {
      throw new Error("publish simulated failure");
    }
  };

  const emailService = {
    async sendVerificationEmailOutboundStrict(): Promise<void> {}
  };

  const configService = {
    getOutboxProcessorEnabled(): boolean {
      return true;
    },
    getOutboxPollIntervalMs(): number {
      return 5000;
    },
    getOutboxMaxRetry(): number {
      return 5;
    },
    getOutboxBatchSize(): number {
      return 50;
    }
  };

  const metrics = new OutboxMetricsService();
  const processor = new OutboxProcessor(
    dataSource as never,
    auditService as never,
    emailService as never,
    configService as never,
    metrics,
    {
      runInTenantScope: async (_tenantId: string, fn: (_m: typeof manager) => Promise<void>) =>
        fn(manager)
    } as never
  );

  await processor.processBatch();

  assert.equal(saved.length, 1);
  assert.equal(saved[0]?.retryCount, 1);
  assert.equal(saved[0]?.status, OutboxEventStatus.PENDING);
});

test("processor marks FAILED when retries reach threshold", async () => {
  const row = buildPendingRow("33333333-3333-4333-8333-333333333333");
  row.retryCount = 4;

  const qb = {
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
      return [row];
    }
  };

  const manager = {
    async count() {
      return 1;
    },
    async query() {
      return [];
    },
    createQueryBuilder() {
      return qb;
    },
    async findOne() {
      return row;
    },
    async save(entity: OutboxEventEntity) {
      return entity;
    }
  };

  const dataSource = {
    async transaction<T>(fn: (_m: typeof manager) => Promise<T>): Promise<T> {
      return fn(manager);
    }
  };

  const auditService = {
    deliverFromOutbox(): void {
      throw new Error("publish simulated failure");
    }
  };

  const emailService = {
    async sendVerificationEmailOutboundStrict(): Promise<void> {}
  };

  const configService = {
    getOutboxProcessorEnabled(): boolean {
      return true;
    },
    getOutboxPollIntervalMs(): number {
      return 5000;
    },
    getOutboxMaxRetry(): number {
      return 5;
    },
    getOutboxBatchSize(): number {
      return 50;
    }
  };

  const metrics = new OutboxMetricsService();
  const processor = new OutboxProcessor(
    dataSource as never,
    auditService as never,
    emailService as never,
    configService as never,
    metrics,
    {
      runInTenantScope: async (_tenantId: string, fn: (_m: typeof manager) => Promise<void>) =>
        fn(manager)
    } as never
  );

  await processor.processBatch();

  assert.equal(row.retryCount, 5);
  assert.equal(row.status, OutboxEventStatus.FAILED);
});

function buildProcessorHarness(input: {
  row: OutboxEventEntity;
  manager: Record<string, unknown>;
}): { processor: OutboxProcessor; metrics: OutboxMetricsService; auditDeliveries: { count: number } } {
  const qb = {
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
      return [input.row];
    }
  };

  const manager = {
    async count() {
      return 1;
    },
    async query() {
      return [];
    },
    createQueryBuilder() {
      return qb;
    },
    ...input.manager
  };

  const dataSource = {
    async transaction<T>(fn: (_m: typeof manager) => Promise<T>): Promise<T> {
      return fn(manager);
    }
  };

  const auditDeliveries = { count: 0 };
  const auditService = {
    deliverFromOutbox(): void {
      auditDeliveries.count += 1;
    }
  };

  const emailService = {
    async sendVerificationEmailOutboundStrict(): Promise<void> {}
  };

  const configService = {
    getOutboxProcessorEnabled(): boolean {
      return true;
    },
    getOutboxPollIntervalMs(): number {
      return 5000;
    },
    getOutboxMaxRetry(): number {
      return 5;
    },
    getOutboxBatchSize(): number {
      return 50;
    }
  };

  const metrics = new OutboxMetricsService();
  const processor = new OutboxProcessor(
    dataSource as never,
    auditService as never,
    emailService as never,
    configService as never,
    metrics,
    {
      runInTenantScope: async (_tenantId: string, fn: (_m: typeof manager) => Promise<void>) =>
        fn(manager)
    } as never
  );

  return { processor, metrics, auditDeliveries };
}

test("registration.accepted Pending to Accepted increments SMS gate metric", async () => {
  const row = buildPendingRow("44444444-4444-4444-8444-444444444444");
  row.payload = {
    entityId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    metadata: {
      previousStatus: RegistrationStatus.PENDING,
      newStatus: RegistrationStatus.ACCEPTED
    }
  };

  const registration = Object.assign(new RegistrationEntity(), {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    tenantId: row.tenantId,
    tourId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    participantContactPhone: "+989120000001",
    paymentStatus: RegistrationPaymentStatus.NOT_PAID
  });
  const tour = Object.assign(new TourEntity(), {
    id: registration.tourId,
    tenantId: row.tenantId,
    costContext: { requiresPayment: true }
  });

  const saved: OutboxEventEntity[] = [];
  const { processor, metrics, auditDeliveries } = buildProcessorHarness({
    row,
    manager: {
      async findOne(entity: unknown, _opts?: { where?: { id?: string } }) {
        if (entity === OutboxEventEntity) {
          return row;
        }
        if (entity === RegistrationEntity) {
          return registration;
        }
        if (entity === TourEntity) {
          return tour;
        }
        return null;
      },
      async save(entity: OutboxEventEntity) {
        saved.push(entity);
        return entity;
      }
    }
  });

  await processor.processBatch();

  assert.equal(auditDeliveries.count, 1);
  assert.equal(saved[0]?.status, OutboxEventStatus.DELIVERED);
  assert.equal(metrics.getSnapshot().registration_accepted_sms_gate_dispatched_total, 1);
});

test("registration.accepted without Pending previousStatus skips SMS gate metric", async () => {
  const row = buildPendingRow("55555555-5555-4555-8555-555555555555");
  row.payload = {
    entityId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    metadata: {
      previousStatus: null,
      newStatus: RegistrationStatus.ACCEPTED
    }
  };

  const saved: OutboxEventEntity[] = [];
  const { processor, metrics, auditDeliveries } = buildProcessorHarness({
    row,
    manager: {
      async findOne(entity: unknown) {
        if (entity === OutboxEventEntity) {
          return row;
        }
        return null;
      },
      async save(entity: OutboxEventEntity) {
        saved.push(entity);
        return entity;
      }
    }
  });

  await processor.processBatch();

  assert.equal(auditDeliveries.count, 1);
  assert.equal(metrics.getSnapshot().registration_accepted_sms_gate_dispatched_total, 0);
});
