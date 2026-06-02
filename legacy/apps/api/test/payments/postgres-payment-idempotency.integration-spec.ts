import assert from "node:assert/strict";
import test from "node:test";
import { DataSource } from "typeorm";
import { PaymentGatewayIdempotencyEntity } from "../../src/modules/payments/entities/payment-gateway-idempotency.entity";
import { PostgresPaymentIdempotencyKeyStore } from "../../src/modules/payments/gateway/postgres-payment-idempotency-key.store";

test("PostgresPaymentIdempotencyKeyStore: duplicate + concurrent + failure (requires DATABASE_URL)", async (t) => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    t.skip("DATABASE_URL not set");
    return;
  }

  const dataSource = new DataSource({
    type: "postgres",
    url,
    entities: [PaymentGatewayIdempotencyEntity],
    synchronize: true,
    logging: false
  });
  await dataSource.initialize();
  const store = new PostgresPaymentIdempotencyKeyStore(dataSource);
  const scope = {
    tenantId: "00000000-0000-4000-8000-000000000099",
    operation: "integration:test:pgw_idemp",
    idempotencyKey: `k-${Date.now()}-${Math.random().toString(36).slice(2)}`
  };

  try {
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

    calls = 0;
    const scope2 = {
      ...scope,
      idempotencyKey: `${scope.idempotencyKey}:concurrent`
    };
    const slow = () =>
      store.runOnce(scope2, async () => {
        calls += 1;
        await new Promise((r) => setTimeout(r, 30));
        return { id: "x" };
      });
    const [x, y] = await Promise.all([slow(), slow()]);
    assert.equal(calls, 1);
    assert.deepEqual(x.value, y.value);

    const scope3 = { ...scope, idempotencyKey: `${scope.idempotencyKey}:fail` };
    let failCalls = 0;
    await assert.rejects(() =>
      store.runOnce(scope3, async () => {
        failCalls += 1;
        throw new Error("boom");
      })
    );
    const ok = await store.runOnce(scope3, async () => {
      failCalls += 1;
      return { ok: true };
    });
    assert.equal(failCalls, 2);
    assert.equal(ok.replayed, false);
    assert.deepEqual(ok.value, { ok: true });
  } finally {
    await dataSource.query(`DELETE FROM payment_gateway_idempotency WHERE tenant_id = $1::uuid`, [
      scope.tenantId
    ]);
    await dataSource.destroy();
  }
});
