import assert from "node:assert/strict";
import test from "node:test";
import { InMemoryIdempotencyKeyStore } from "./payment-idempotency-key.store";

test("IdempotencyKeyStore: duplicate key returns same payload with replayed=true", async () => {
  const store = new InMemoryIdempotencyKeyStore();
  const scope = {
    tenantId: "t1",
    operation: "test:op",
    idempotencyKey: "k1"
  };
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
});

test("IdempotencyKeyStore: concurrent callers share one execution", async () => {
  const store = new InMemoryIdempotencyKeyStore();
  const scope = { tenantId: "t1", operation: "test:concurrent", idempotencyKey: "k2" };
  let calls = 0;
  const slow = () =>
    store.runOnce(scope, async () => {
      calls += 1;
      await new Promise((r) => setTimeout(r, 20));
      return { id: "one" };
    });
  const [x, y] = await Promise.all([slow(), slow()]);
  assert.equal(calls, 1);
  assert.equal(x.value.id, "one");
  assert.equal(y.value.id, "one");
  assert.notEqual(x.replayed, y.replayed);
});

test("IdempotencyKeyStore: failure is not cached — retry runs fn again", async () => {
  const store = new InMemoryIdempotencyKeyStore();
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
});
