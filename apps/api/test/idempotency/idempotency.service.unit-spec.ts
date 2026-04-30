import assert from "node:assert/strict";
import test from "node:test";
import { ConflictException } from "@nestjs/common";
import type { DataSource } from "typeorm";
import { IdempotencyService } from "../../src/modules/idempotency/idempotency.service";

function createFixture() {
  const rows = new Map<string, any>();
  const manager = {
    async findOne(_: unknown, opts: { where: { key: string } }) {
      return rows.get(opts.where.key) ?? null;
    },
    create(_: unknown, payload: Record<string, unknown>) {
      return {
        id: `id-${rows.size + 1}`,
        createdAt: new Date(),
        ...payload
      };
    },
    async save(row: any) {
      rows.set(row.key, row);
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
    async transaction<T>(fn: (m: typeof manager) => Promise<T>): Promise<T> {
      return fn(manager);
    }
  } as unknown as DataSource;
  const repo = {
    async findOne(opts: { where: { key: string } }) {
      return rows.get(opts.where.key) ?? null;
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
    { key: "k1", endpoint: "/register", requestHash: "h1" },
    async () => {
      executions += 1;
      return { ok: true, run: executions };
    }
  );
  const second = await service.executeWithIdempotency(
    { key: "k1", endpoint: "/register", requestHash: "h1" },
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
    { key: "k2", endpoint: "/register", requestHash: "hash-a" },
    async () => ({ ok: true })
  );

  await assert.rejects(
    () =>
      service.executeWithIdempotency(
        { key: "k2", endpoint: "/register", requestHash: "hash-b" },
        async () => ({ ok: false })
      ),
    (error: unknown) =>
      error instanceof ConflictException &&
      (error.getResponse() as { error?: { code?: string } }).error?.code ===
        "IDEMPOTENCY_KEY_PAYLOAD_MISMATCH"
  );
});

test("expired key allows a new execution", async () => {
  const { service, rows } = createFixture();
  let executions = 0;
  await service.executeWithIdempotency(
    { key: "k3", endpoint: "/register", requestHash: "h3" },
    async () => {
      executions += 1;
      return { run: executions };
    }
  );
  const current = rows.get("k3");
  current.expiresAt = new Date(Date.now() - 1000);
  rows.set("k3", current);

  const second = await service.executeWithIdempotency(
    { key: "k3", endpoint: "/register", requestHash: "h3" },
    async () => {
      executions += 1;
      return { run: executions };
    }
  );
  assert.equal(second.responseBody.run, 2);
  assert.equal(executions, 2);
});
