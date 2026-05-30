import assert from "node:assert/strict";
import test from "node:test";
import type Redis from "ioredis";
import { CapacityExceededException } from "../../../common/errors/capacity-exceeded.exception";
import { RedisTourCapacityReservationService } from "./redis-tour-capacity-reservation.service";

class MiniRedis {
  readonly data = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.data.has(key) ? (this.data.get(key) as string) : null;
  }

  async set(key: string, value: string): Promise<"OK"> {
    this.data.set(key, value);
    return "OK";
  }

  async incr(key: string): Promise<number> {
    const next = Number(this.data.get(key) ?? "0") + 1;
    this.data.set(key, String(next));
    return next;
  }

  async decr(key: string): Promise<number> {
    const next = Number(this.data.get(key) ?? "0") - 1;
    this.data.set(key, String(next));
    return next;
  }

  async exists(key: string): Promise<number> {
    return this.data.has(key) ? 1 : 0;
  }

  async eval(script: string, _numKeys: number, key: string, ...args: string[]): Promise<number> {
    if (script.includes("DECR")) {
      const seed = Number(args[0] ?? "0");
      if ((await this.exists(key)) === 0) {
        await this.set(key, String(Math.max(0, seed)));
      }
      return this.decr(key);
    }
    const cap = Number(args[0] ?? "0");
    const current = Number((await this.get(key)) ?? "0");
    if (current >= cap) {
      return current;
    }
    return this.incr(key);
  }
}

function createService() {
  const mini = new MiniRedis();
  return {
    mini,
    service: new RedisTourCapacityReservationService(mini as unknown as Redis),
  };
}

const baseInput = {
  tenantId: "11111111-1111-4111-8111-111111111111",
  tourId: "22222222-2222-4222-8222-222222222222",
  totalCapacity: 2,
  acceptedCount: 0,
};

test("Redis capacity reservation: lazy seed then reserve decrements remaining", async () => {
  const { mini, service } = createService();
  await service.reserveTicket(baseInput);
  assert.equal(await mini.get("tours:capacity:remaining:11111111-1111-4111-8111-111111111111:22222222-2222-4222-8222-222222222222"), "1");
});

test("Redis capacity reservation: full tour throws CAPACITY_FULL and rolls back DECR", async () => {
  const { mini, service } = createService();
  await service.reserveTicket(baseInput);
  await service.reserveTicket({ ...baseInput, acceptedCount: 1 });
  await assert.rejects(
    () => service.reserveTicket({ ...baseInput, acceptedCount: 1 }),
    (err: unknown) => err instanceof CapacityExceededException
  );
  assert.equal(await mini.get("tours:capacity:remaining:11111111-1111-4111-8111-111111111111:22222222-2222-4222-8222-222222222222"), "0");
});

test("Redis capacity reservation: release is capped at totalCapacity", async () => {
  const { mini, service } = createService();
  await service.syncRemainingFromSnapshot({ ...baseInput, acceptedCount: 0 });
  await service.releaseTicket({
    tenantId: baseInput.tenantId,
    tourId: baseInput.tourId,
    totalCapacity: baseInput.totalCapacity,
  });
  assert.equal(await mini.get("tours:capacity:remaining:11111111-1111-4111-8111-111111111111:22222222-2222-4222-8222-222222222222"), "2");
});

test("Redis capacity reservation: tenant ids are normalized in key", async () => {
  const { mini, service } = createService();
  await service.reserveTicket({
    ...baseInput,
    tenantId: "11111111-1111-4111-8111-111111111111".toUpperCase(),
  });
  assert.ok(
    mini.data.has("tours:capacity:remaining:11111111-1111-4111-8111-111111111111:22222222-2222-4222-8222-222222222222")
  );
});

test("Redis capacity reservation: syncRemainingFromSnapshot overwrites key", async () => {
  const { mini, service } = createService();
  await service.reserveTicket(baseInput);
  await service.syncRemainingFromSnapshot({ ...baseInput, acceptedCount: 1 });
  assert.equal(await mini.get("tours:capacity:remaining:11111111-1111-4111-8111-111111111111:22222222-2222-4222-8222-222222222222"), "1");
});
