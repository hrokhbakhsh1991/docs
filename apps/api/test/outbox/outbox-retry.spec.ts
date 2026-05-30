import assert from "node:assert/strict";
import test from "node:test";
import { OutboxProcessor } from "../../src/modules/outbox/repositories/outbox.processor";
import { OutboxMetricsService } from "../../src/modules/outbox/outbox-metrics.service";
import {
  OutboxEventEntity,
  OutboxEventStatus
} from "../../src/modules/outbox/entities/outbox-event.entity";

function buildPendingRow(id: string): OutboxEventEntity {
  const row = new OutboxEventEntity();
  row.id = id;
  row.tenantId = "44444444-4444-4444-8444-444444444444";
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

function createProcessorWithSingleRow(row: OutboxEventEntity): OutboxProcessor {
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
    async findOne(entity: unknown, opts: { where: { id: string } }) {
      if (entity === OutboxEventEntity && opts.where.id === row.id) {
        return row;
      }
      return null;
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

  return new OutboxProcessor(
    dataSource as never,
    auditService as never,
    emailService as never,
    configService as never,
    new OutboxMetricsService(),
    {
      runInTenantScope: async (_tenantId: string, fn: (_manager: unknown) => Promise<void>) =>
        fn(manager)
    } as never
  );
}

test("outbox failure increments retry_count", async () => {
  const row = buildPendingRow("44444444-4444-4444-8444-444444444444");
  const processor = createProcessorWithSingleRow(row);

  await processor.processBatch();

  assert.equal(row.retryCount, 1);
});

test("outbox failure sets next_retry_at with exponential backoff", async () => {
  const row = buildPendingRow("55555555-5555-4555-8555-555555555555");
  row.retryCount = 2;
  const before = Date.now();
  const processor = createProcessorWithSingleRow(row);

  await processor.processBatch();

  const expectedDelayMs = 2 ** 3 * 60 * 1000;
  const lowerBound = before + expectedDelayMs - 1_500;
  const upperBound = before + expectedDelayMs + 1_500;
  assert.equal(row.retryCount, 3);
  assert.equal(row.nextRetryAt instanceof Date, true);
  const nextRetryTime = row.nextRetryAt?.getTime() ?? 0;
  assert.equal(nextRetryTime >= lowerBound && nextRetryTime <= upperBound, true);
});

test("outbox retry stops after five attempts", async () => {
  const row = buildPendingRow("66666666-6666-4666-8666-666666666666");
  row.retryCount = 4;
  const processor = createProcessorWithSingleRow(row);

  await processor.processBatch();

  assert.equal(row.retryCount, 5);
  assert.equal(row.status, OutboxEventStatus.FAILED);
  assert.equal(row.nextRetryAt, null);
});
