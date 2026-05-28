import assert from "node:assert/strict";
import test from "node:test";
import { ConflictException } from "@nestjs/common";
import type { DataSource } from "typeorm";
import { IdempotencyService } from "../../src/modules/idempotency/idempotency.service";

function createFixture() {
  const rows = new Map<string, any>();
  const storageKey = (tenantId: string, key: string) => `${tenantId}:${key}`;
  const manager = {
    async findOne(_: unknown, opts: { where: { tenantId: string; key: string } }) {
      return rows.get(storageKey(opts.where.tenantId, opts.where.key)) ?? null;
    },
    create(_: unknown, payload: Record<string, unknown>) {
      return {
        id: `id-${rows.size + 1}`,
        createdAt: new Date(),
        ...payload
      };
    },
    async save(row: any) {
      rows.set(storageKey(row.tenantId, row.key), row);
      return row;
    },
    async delete(_: unknown, opts: { id: string }) {
      for (const [k, v] of rows.entries()) {
        if (v.id === opts.id) {
          rows.delete(k);
        }
      }
    }
  };
  const dataSource = {
    async transaction<T>(fn: (_m: typeof manager) => Promise<T>): Promise<T> {
      return fn(manager);
    }
  } as unknown as DataSource;
  const repo = {
    async findOne(opts: { where: { tenantId: string; key: string } }) {
      return rows.get(storageKey(opts.where.tenantId, opts.where.key)) ?? null;
    },
    async delete() {
      return { affected: 0 };
    }
  };
  const service = new IdempotencyService(repo as never, dataSource);
  return { service, rows };
}

test("same idempotency key returns stored response on second call", async () => {
  const { service } = createFixture();
  let executions = 0;
  const first = await service.executeWithIdempotency(
    { tenantId: "tenant-1", key: "k1", endpoint: "/register", requestHash: "h1" },
    async () => {
      executions += 1;
      return { ok: true, run: executions };
    }
  );
  const second = await service.executeWithIdempotency(
    { tenantId: "tenant-1", key: "k1", endpoint: "/register", requestHash: "h1" },
    async () => {
      executions += 1;
      return { ok: true, run: executions };
    }
  );
  assert.equal(first.responseBody.run, 1);
  assert.equal(second.responseBody.run, 1);
  assert.equal(executions, 1);
});

test("same key with different body hash returns 409 conflict", async () => {
  const { service } = createFixture();
  await service.executeWithIdempotency(
    { tenantId: "tenant-1", key: "k2", endpoint: "/register", requestHash: "hash-a" },
    async () => ({ ok: true })
  );

  await assert.rejects(
    () =>
      service.executeWithIdempotency(
        { tenantId: "tenant-1", key: "k2", endpoint: "/register", requestHash: "hash-b" },
        async () => ({ ok: false })
      ),
    (error: unknown) =>
      error instanceof ConflictException &&
      (error.getResponse() as { error?: { code?: string } }).error?.code ===
        "IDEMPOTENCY_KEY_REPLAY_MISMATCH"
  );
});

test("expired key allows a new execution", async () => {
  const { service, rows } = createFixture();
  let executions = 0;
  await service.executeWithIdempotency(
    { tenantId: "tenant-1", key: "k3", endpoint: "/register", requestHash: "h3" },
    async () => {
      executions += 1;
      return { run: executions };
    }
  );
  const current = rows.get("tenant-1:k3");
  current.expiresAt = new Date(Date.now() - 1000);
  rows.set("tenant-1:k3", current);

  const second = await service.executeWithIdempotency(
    { tenantId: "tenant-1", key: "k3", endpoint: "/register", requestHash: "h3" },
    async () => {
      executions += 1;
      return { run: executions };
    }
  );
  assert.equal(second.responseBody.run, 2);
  assert.equal(executions, 2);
});

test("same idempotency key is isolated per tenant", async () => {
  const { service } = createFixture();
  const first = await service.executeWithIdempotency(
    { tenantId: "tenant-a", key: "shared-key", endpoint: "/register", requestHash: "h1" },
    async () => ({ tenant: "a" })
  );
  const second = await service.executeWithIdempotency(
    { tenantId: "tenant-b", key: "shared-key", endpoint: "/register", requestHash: "h1" },
    async () => ({ tenant: "b" })
  );
  assert.equal(first.responseBody.tenant, "a");
  assert.equal(second.responseBody.tenant, "b");
});

test("near-simultaneous duplicate request returns in-progress conflict", async () => {
  const { service } = createFixture();
  let releaseHandler!: () => void;
  const waitForRelease = new Promise<void>((resolve) => {
    releaseHandler = resolve;
  });

  const first = service.executeWithIdempotency(
    { tenantId: "tenant-1", key: "race-key", endpoint: "/register", requestHash: "h1" },
    async () => {
      await waitForRelease;
      return { ok: true };
    }
  );
  await new Promise((resolve) => setImmediate(resolve));

  const second = service.executeWithIdempotency(
    { tenantId: "tenant-1", key: "race-key", endpoint: "/register", requestHash: "h1" },
    async () => ({ shouldNotRun: true })
  );

  await assert.rejects(
    () => second,
    (error: unknown) =>
      error instanceof ConflictException &&
      (error.getResponse() as { error?: { code?: string } }).error?.code ===
        "IDEMPOTENCY_REQUEST_IN_PROGRESS"
  );

  releaseHandler();
  const firstResult = await first;
  assert.equal(firstResult.responseBody.ok, true);
});
