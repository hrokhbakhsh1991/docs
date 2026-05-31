import assert from "node:assert/strict";
import test from "node:test";
import { OutboxProcessor } from "../../src/modules/outbox/repositories/outbox.processor";
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

function buildPendingRow(id: string, tenantId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"): OutboxEventEntity {
  const row = new OutboxEventEntity();
  row.id = id;
  row.tenantId = tenantId;
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

function makeOutboxManager(
  rows: OutboxEventEntity[],
  saved: OutboxEventEntity[] = [],
): {
  manager: {
    count(): Promise<number>;
    query(): Promise<unknown[]>;
    findOne(entity: unknown, opts?: { where?: { id?: string } }): Promise<OutboxEventEntity | null>;
    createQueryBuilder(entity?: unknown): unknown;
    save(entity: OutboxEventEntity): Promise<OutboxEventEntity>;
  };
  saved: OutboxEventEntity[];
} {
  let bulkFailIds: string[] = [];

  const selectQb = {
    where() {
      return this;
    },
    andWhere() {
      return this;
    },
    orderBy() {
      return this;
    },
    addOrderBy() {
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
      return rows.filter((row) => row.status === OutboxEventStatus.PENDING);
    },
  };

  const updateQb = {
    update() {
      return this;
    },
    set() {
      return this;
    },
    where(_clause: string, params?: { outboxIds?: string[] }) {
      bulkFailIds = params?.outboxIds ?? [];
      return this;
    },
    andWhere() {
      return this;
    },
    async execute() {
      for (const id of bulkFailIds) {
        const row = rows.find((candidate) => candidate.id === id);
        if (!row) {
          continue;
        }
        row.status = OutboxEventStatus.FAILED;
        row.nextRetryAt = null;
        row.retryCount = 5;
        saved.push(row);
      }
    },
  };

  const manager = {
    async count() {
      return rows.filter((row) => row.status === OutboxEventStatus.PENDING).length;
    },
    async query() {
      return [];
    },
    async findOne(entity: unknown, opts?: { where?: { id?: string } }) {
      if (entity === OutboxEventEntity && opts?.where?.id) {
        return rows.find((row) => row.id === opts.where?.id) ?? null;
      }
      return rows[0] ?? null;
    },
    createQueryBuilder(entity?: unknown) {
      if (entity === OutboxEventEntity || entity === "o") {
        return selectQb;
      }
      return updateQb;
    },
    async save(entity: OutboxEventEntity) {
      saved.push(entity);
      return entity;
    },
  };

  return { manager, saved };
}

test("processor marks row DELIVERED after successful publish", async () => {
  const row = buildPendingRow("11111111-1111-4111-8111-111111111111");
  const saved: OutboxEventEntity[] = [];
  const { manager } = makeOutboxManager([row], saved);

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
    } as never,
    {} as never
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
  const { manager } = makeOutboxManager([row], saved);

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
    } as never,
    {} as never
  );

  await processor.processBatch();

  assert.equal(saved.length, 1);
  assert.equal(saved[0]?.retryCount, 1);
  assert.equal(saved[0]?.status, OutboxEventStatus.PENDING);
});

test("processor marks FAILED when retries reach threshold", async () => {
  const row = buildPendingRow("33333333-3333-4333-8333-333333333333");
  row.retryCount = 4;
  const saved: OutboxEventEntity[] = [];
  const { manager } = makeOutboxManager([row], saved);

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
    } as never,
    {} as never
  );

  await processor.processBatch();

  assert.equal(row.retryCount, 5);
  assert.equal(row.status, OutboxEventStatus.FAILED);
});

function buildProcessorHarness(input: {
  rows: OutboxEventEntity[];
  manager?: Record<string, unknown>;
}): {
  processor: OutboxProcessor;
  metrics: OutboxMetricsService;
  auditDeliveries: { count: number };
  saved: OutboxEventEntity[];
} {
  const saved: OutboxEventEntity[] = [];
  const { manager: baseManager } = makeOutboxManager(input.rows, saved);
  const manager = {
    ...baseManager,
    ...input.manager,
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
    } as never,
    {} as never
  );

  return { processor, metrics, auditDeliveries, saved };
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

  const { processor, metrics, auditDeliveries, saved } = buildProcessorHarness({
    rows: [row],
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
    },
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

  const { processor, metrics, auditDeliveries } = buildProcessorHarness({
    rows: [row],
    manager: {
      async findOne(entity: unknown) {
        if (entity === OutboxEventEntity) {
          return row;
        }
        return null;
      },
    },
  });

  await processor.processBatch();

  assert.equal(auditDeliveries.count, 1);
  assert.equal(metrics.getSnapshot().registration_accepted_sms_gate_dispatched_total, 0);
});

test("processor marks FAILED immediately when payload tenantId mismatches row tenant_id", async () => {
  const row = buildPendingRow("66666666-6666-4666-8666-666666666666");
  row.payload = {
    tenantId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    entityId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  };

  const { processor, auditDeliveries, saved } = buildProcessorHarness({
    rows: [row],
  });

  await processor.processBatch();

  assert.equal(auditDeliveries.count, 0);
  assert.equal(saved.length, 1);
  assert.equal(saved[0]?.status, OutboxEventStatus.FAILED);
  assert.equal(saved[0]?.nextRetryAt, null);
});

test("processor bulk-fails poison rows and delivers valid rows in the same batch cycle", async () => {
  const poisonA = buildPendingRow("77777777-7777-4777-8777-777777777777");
  poisonA.payload = {
    tenantId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    entityId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  };
  const poisonB = buildPendingRow("88888888-8888-4888-8888-888888888888");
  poisonB.payload = {
    tenant_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    entityId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  };
  const validRow = buildPendingRow("99999999-9999-4999-8999-999999999999");

  const { processor, auditDeliveries, saved } = buildProcessorHarness({
    rows: [poisonA, poisonB, validRow],
  });

  await processor.processBatch();

  assert.equal(auditDeliveries.count, 1);
  assert.equal(
    saved.filter((row) => row.status === OutboxEventStatus.FAILED).length,
    2,
  );
  assert.equal(
    saved.some((row) => row.id === validRow.id && row.status === OutboxEventStatus.DELIVERED),
    true,
  );
});
