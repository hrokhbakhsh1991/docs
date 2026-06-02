import assert from "node:assert/strict";
import test from "node:test";
import type Redis from "ioredis";
import { SecurityIsolationBreachException } from "../../../common/errors/security-isolation-breach.exception";
import { RedisPaymentIdempotencyKeyStore } from "./redis-payment-idempotency-key.store";
import { paymentGatewayIdempotencyDigest } from "./payment-idempotency-key.store";

const REDIS_KEY_PREFIX = "paygw:idemp:v2:";

/**
 * Minimal Redis subset used by {@link RedisPaymentIdempotencyKeyStore} (no TTL expiry simulation).
 */
class MiniRedis {
  readonly data = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.data.has(key) ? (this.data.get(key) as string) : null;
  }

  async del(key: string): Promise<number> {
    return this.data.delete(key) ? 1 : 0;
  }

  async set(key: string, value: string, ...args: unknown[]): Promise<"OK" | null> {
    const nx = args.includes("NX");
    if (nx && this.data.has(key)) {
      return null;
    }
    this.data.set(key, value);
    return "OK";
  }

  async quit(): Promise<"OK"> {
    this.data.clear();
    return "OK";
  }
}

function createStore() {
  const mini = new MiniRedis();
  return new RedisPaymentIdempotencyKeyStore(mini as unknown as Redis);
}

test("Redis IdempotencyKeyStore: duplicate key returns same payload with replayed=true", async () => {
  const store = createStore();
  const scope = { tenantId: "t1", operation: "test:op", idempotencyKey: "k1" };
  let calls = 0;
  const a = await store.runOnce(scope, async () => {
    calls += 1;
    return { n: 1 };
  });
  const b = await store.runOnce(scope, async () => {
    calls += 1;
    return { n: 2 };
  });
  assert.equal(calls, 1);
  assert.equal(a.replayed, false);
  assert.equal(b.replayed, true);
  assert.deepEqual(a.value, { n: 1 });
  assert.deepEqual(b.value, { n: 1 });
  await store.onModuleDestroy();
});

test("Redis IdempotencyKeyStore: concurrent callers share one execution", async () => {
  const store = createStore();
  const scope = { tenantId: "t1", operation: "test:concurrent", idempotencyKey: "k2" };
  let calls = 0;
  const slow = () =>
    store.runOnce(scope, async () => {
      calls += 1;
      await new Promise((r) => setTimeout(r, 25));
      return { id: "one" };
    });
  const [x, y] = await Promise.all([slow(), slow()]);
  assert.equal(calls, 1);
  assert.equal(x.value.id, "one");
  assert.equal(y.value.id, "one");
  assert.notEqual(x.replayed, y.replayed);
  await store.onModuleDestroy();
});

test("Redis IdempotencyKeyStore: failure is not cached — retry runs fn again", async () => {
  const store = createStore();
  const scope = { tenantId: "t1", operation: "test:fail", idempotencyKey: "k3" };
  let calls = 0;
  await assert.rejects(() =>
    store.runOnce(scope, async () => {
      calls += 1;
      throw new Error("boom");
    })
  );
  const ok = await store.runOnce(scope, async () => {
    calls += 1;
    return { ok: true };
  });
  assert.equal(calls, 2);
  assert.equal(ok.replayed, false);
  assert.deepEqual(ok.value, { ok: true });
  await store.onModuleDestroy();
});

test("Redis IdempotencyKeyStore: cross-tenant envelope read is blocked", async () => {
  const mini = new MiniRedis();
  const store = new RedisPaymentIdempotencyKeyStore(mini as unknown as Redis);
  const scopeB = { tenantId: "tenant-b", operation: "test:op", idempotencyKey: "k-cross" };
  const keyB = `${REDIS_KEY_PREFIX}${paymentGatewayIdempotencyDigest(scopeB)}`;
  mini.data.set(keyB, JSON.stringify({ tenantId: "tenant-a", value: { n: 1 } }));

  await assert.rejects(
    () =>
      store.runOnce(scopeB, async () => {
        throw new Error("must not execute");
      }),
    (error: unknown) => error instanceof SecurityIsolationBreachException
  );

  await store.onModuleDestroy();
});
