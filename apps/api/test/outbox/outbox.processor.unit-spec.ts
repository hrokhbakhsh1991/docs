import assert from "node:assert/strict";
import test from "node:test";
import { OutboxProcessor } from "../../src/modules/outbox/outbox.processor";
import { OutboxMetricsService } from "../../src/modules/outbox/outbox-metrics.service";
import { SchedulerLockService } from "../../src/jobs/scheduler-lock.service";
import { SchedulerRuntimeMetricsService } from "../../src/jobs/scheduler-runtime-metrics.service";
import {
  OutboxEventEntity,
  OutboxEventStatus
} from "../../src/modules/outbox/entities/outbox-event.entity";

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
    async transaction<T>(fn: (m: typeof manager) => Promise<T>): Promise<T> {
      return fn(manager);
    }
  };

  let deliveries = 0;
  const auditService = {
    deliverFromOutbox(): void {
      deliveries += 1;
    }
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
    configService as never,
    metrics,
    {
      runInTenantScope: async (_tenantId: string, fn: (m: typeof manager) => Promise<void>) =>
        fn(manager)
    } as never,
    {
      runWithGlobalLock: async (_name: string, onLocked: () => Promise<void>) => {
        await onLocked();
        return { acquired: true };
      }
    } as SchedulerLockService,
    {
      noteStarted: () => undefined,
      noteFinished: () => undefined,
      noteFailed: () => undefined,
      noteSkippedDueLock: () => undefined
    } as unknown as SchedulerRuntimeMetricsService
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
    async transaction<T>(fn: (m: typeof manager) => Promise<T>): Promise<T> {
      return fn(manager);
    }
  };

  const auditService = {
    deliverFromOutbox(): void {
      throw new Error("publish simulated failure");
    }
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
    configService as never,
    metrics,
    {
      runInTenantScope: async (_tenantId: string, fn: (m: typeof manager) => Promise<void>) =>
        fn(manager)
    } as never,
    {
      runWithGlobalLock: async (_name: string, onLocked: () => Promise<void>) => {
        await onLocked();
        return { acquired: true };
      }
    } as SchedulerLockService,
    {
      noteStarted: () => undefined,
      noteFinished: () => undefined,
      noteFailed: () => undefined,
      noteSkippedDueLock: () => undefined
    } as unknown as SchedulerRuntimeMetricsService
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
    async transaction<T>(fn: (m: typeof manager) => Promise<T>): Promise<T> {
      return fn(manager);
    }
  };

  const auditService = {
    deliverFromOutbox(): void {
      throw new Error("publish simulated failure");
    }
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
    configService as never,
    metrics,
    {
      runInTenantScope: async (_tenantId: string, fn: (m: typeof manager) => Promise<void>) =>
        fn(manager)
    } as never,
    {
      runWithGlobalLock: async (_name: string, onLocked: () => Promise<void>) => {
        await onLocked();
        return { acquired: true };
      }
    } as SchedulerLockService,
    {
      noteStarted: () => undefined,
      noteFinished: () => undefined,
      noteFailed: () => undefined,
      noteSkippedDueLock: () => undefined
    } as unknown as SchedulerRuntimeMetricsService
  );

  await processor.processBatch();

  assert.equal(row.retryCount, 5);
  assert.equal(row.status, OutboxEventStatus.FAILED);
});
