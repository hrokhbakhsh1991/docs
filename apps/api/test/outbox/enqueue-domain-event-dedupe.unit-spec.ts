import assert from "node:assert/strict";
import test from "node:test";
import type { EntityManager } from "typeorm";
import { QueryFailedError } from "typeorm";
import { enqueueOutboxEvent } from "../../src/common/outbox/enqueue-outbox-event";

test("enqueueOutboxEvent: duplicate domainEventId is swallowed (idempotent enqueue)", async () => {
  let saveCalls = 0;
  const manager = {
    create(_cls: unknown, payload: Record<string, unknown>) {
      return { ...payload };
    },
    async save(entity: Record<string, unknown>) {
      saveCalls += 1;
      if (saveCalls === 2 && entity.domainEventId === "booking.created:reg-1") {
        const err = new QueryFailedError("", [], new Error("duplicate key"));
        Object.assign(err, { driverError: { code: "23505" } });
        throw err;
      }
      return entity;
    }
  } as unknown as EntityManager;

  const base = {
    tenantId: "66666666-6666-4666-8666-666666666666",
    eventType: "booking.created",
    aggregateType: "Registration",
    aggregateId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    domainEventId: "booking.created:reg-1",
    payload: { envelope: { x: 1 } }
  };

  assert.equal(await enqueueOutboxEvent(manager, base), true);
  assert.equal(await enqueueOutboxEvent(manager, base), false);
  assert.equal(saveCalls, 2);
});

test("enqueueOutboxEvent: non-unique errors propagate", async () => {
  const manager = {
    create(_cls: unknown, payload: Record<string, unknown>) {
      return { ...payload };
    },
    async save() {
      const err = new QueryFailedError("", [], new Error("other"));
      Object.assign(err, { driverError: { code: "23503" } });
      throw err;
    }
  } as unknown as EntityManager;

  await assert.rejects(
    () =>
      enqueueOutboxEvent(manager, {
        tenantId: "66666666-6666-4666-8666-666666666666",
        eventType: "booking.created",
        payload: {}
      }),
    (e: unknown) => e instanceof QueryFailedError
  );
});
