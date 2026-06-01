import assert from "node:assert/strict";
import test from "node:test";

import { NotFoundException } from "@nestjs/common";

import {
  TourCloneSourceLockedException,
  ToursCloneSourceLockService,
} from "../../../src/modules/tours/services/tours-clone-source-lock.service";

test("ToursCloneSourceLockService: redis SET NX failure throws TOUR_CLONE_SOURCE_LOCKED", async () => {
  const redis = {
    async set() {
      return null;
    },
    async eval() {
      return 0;
    },
  };
  const service = new ToursCloneSourceLockService(redis as never, {} as never);

  await assert.rejects(
    () =>
      service.withSourceCloneLock(
        "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        "tenant-1",
        async () => "ok",
      ),
    (error: unknown) => error instanceof TourCloneSourceLockedException,
  );
});

test("ToursCloneSourceLockService: redis lock runs fn and releases on success", async () => {
  const keys = new Map<string, string>();
  const redis = {
    async set(key: string, token: string, ..._args: string[]) {
      if (keys.has(key)) {
        return null;
      }
      keys.set(key, token);
      return "OK";
    },
    async eval(_script: string, _n: number, key: string, token: string) {
      if (keys.get(key) === token) {
        keys.delete(key);
        return 1;
      }
      return 0;
    },
  };
  const service = new ToursCloneSourceLockService(redis as never, {} as never);

  const result = await service.withSourceCloneLock(
    "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    "tenant-1",
    async () => 42,
  );
  assert.equal(result, 42);
  assert.equal(keys.size, 0);
});

test("ToursCloneSourceLockService: postgres fallback 404 when source missing", async () => {
  const writeRepo = {
    async runInTransaction<T>(fn: () => Promise<T>) {
      return fn();
    },
    async loadTourForUpdateLocking() {
      return null;
    },
  };
  const service = new ToursCloneSourceLockService(null, writeRepo as never);

  await assert.rejects(
    () =>
      service.withSourceCloneLock(
        "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        "tenant-1",
        async () => "ok",
      ),
    (error: unknown) => error instanceof NotFoundException,
  );
});
