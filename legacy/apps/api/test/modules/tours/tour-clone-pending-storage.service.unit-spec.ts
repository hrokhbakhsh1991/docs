import assert from "node:assert/strict";
import test from "node:test";

import {
  PendingStorageDeletionEntity,
  PendingStorageDeletionStatus,
} from "../../../src/modules/tours/entities/pending-storage-deletion.entity";
import { TourClonePendingStorageService } from "../../../src/modules/tours/services/tour-clone-pending-storage.service";

test("executeCloneCopiesWithSaga registers each dest key before copyObject", async () => {
  const saved: Array<{ objectKey: string; cloneOperationId: string }> = [];
  const copies: string[] = [];

  const manager = {
    create(_: unknown, row: PendingStorageDeletionEntity) {
      return row;
    },
    async save(row: PendingStorageDeletionEntity) {
      saved.push({ objectKey: row.objectKey, cloneOperationId: row.cloneOperationId });
      return row;
    },
  };

  const tenantDbContext = {
    runInTenantScope: async <T>(_tenantId: string, fn: (m: typeof manager) => Promise<T>) => fn(manager),
  };

  const fileStorage = {
    async copyObject(input: { destKey: string }) {
      copies.push(input.destKey);
    },
  };

  const service = new TourClonePendingStorageService(
    tenantDbContext as never,
    { error: () => undefined } as never,
  );
  const cloneOperationId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

  await service.executeCloneCopiesWithSaga({
    tenantId: "tenant-1",
    cloneOperationId,
    fileStorage: fileStorage as never,
    plans: [
      {
        sourcePhotoId: "s1",
        destPhotoId: "d1",
        filename: "a.jpg",
        sourceKey: "src/a",
        destKey: "dest/a",
      },
      {
        sourcePhotoId: "s2",
        destPhotoId: "d2",
        filename: "b.jpg",
        sourceKey: "src/b",
        destKey: "dest/b",
      },
    ],
  });

  assert.equal(saved.length, 2);
  assert.equal(copies.length, 2);
  assert.equal(saved[0]!.objectKey, "dest/a");
  assert.equal(saved[0]!.cloneOperationId, cloneOperationId);
  assert.deepEqual(copies, ["dest/a", "dest/b"]);
  assert.equal(saved[1]!.objectKey, "dest/b");
  assert.equal(
    saved.every((row) => row.cloneOperationId === cloneOperationId),
    true,
  );
});

test("releaseCloneOperation marks committed and deletes rows", async () => {
  const updates: unknown[] = [];
  const deletes: unknown[] = [];

  const manager = {
    async update(_entity: unknown, _criteria: unknown, patch: unknown) {
      updates.push(patch);
    },
    async delete(_entity: unknown, criteria: unknown) {
      deletes.push(criteria);
    },
  };

  const tenantDbContext = {
    runInTenantScope: async <T>(_tenantId: string, fn: (m: typeof manager) => Promise<T>) => fn(manager),
  };

  const service = new TourClonePendingStorageService(
    tenantDbContext as never,
    { error: () => undefined } as never,
  );
  await service.releaseCloneOperation("tenant-1", "op-1");

  assert.deepEqual(updates, [{ status: PendingStorageDeletionStatus.COMMITTED }]);
  assert.equal((deletes[0] as { cloneOperationId: string }).cloneOperationId, "op-1");
});

test("releaseCloneOperation logs TOUR_CLONE_ORPHAN_SWEEP_DELETE_FAILED when deleteObject fails", async () => {
  const manager = {
    async find() {
      return [
        {
          objectKey: "tenant-1/tours/new/photos/a.jpg",
          cloneOperationId: "op-1",
          tenantId: "tenant-1",
          status: PendingStorageDeletionStatus.PENDING,
        },
        {
          objectKey: "tenant-1/tours/new/photos/b.jpg",
          cloneOperationId: "op-1",
          tenantId: "tenant-1",
          status: PendingStorageDeletionStatus.PENDING,
        },
      ];
    },
    async update() {
      return undefined;
    },
    async delete() {
      return undefined;
    },
  };

  const tenantDbContext = {
    runInTenantScope: async <T>(_tenantId: string, fn: (m: typeof manager) => Promise<T>) => fn(manager),
  };

  const loggerCalls: unknown[] = [];
  const service = new TourClonePendingStorageService(tenantDbContext as never, {
    error: (_msg: string, meta: unknown) => {
      loggerCalls.push(meta);
    },
  } as never);
  await service.releaseCloneOperation("tenant-1", "op-1", {
    fileStorage: {
      async deleteObject() {
        throw new Error("MINIO_DELETE_FAILED");
      },
    } as never,
  });

  assert.equal(loggerCalls.length, 2);
  assert.equal((loggerCalls[0] as { code?: string }).code, "TOUR_CLONE_ORPHAN_SWEEP_DELETE_FAILED");
});

test("releaseCloneOperation sweeps copied objects when clone persist failed", async () => {
  const deleted: string[] = [];

  const manager = {
    async find() {
      return [
        {
          objectKey: "tenant-1/tours/new/photos/a.jpg",
          cloneOperationId: "op-1",
          tenantId: "tenant-1",
          status: PendingStorageDeletionStatus.PENDING,
        },
        {
          objectKey: "tenant-1/tours/new/photos/b.jpg",
          cloneOperationId: "op-1",
          tenantId: "tenant-1",
          status: PendingStorageDeletionStatus.PENDING,
        },
      ];
    },
    async update() {
      return undefined;
    },
    async delete() {
      return undefined;
    },
  };

  const tenantDbContext = {
    runInTenantScope: async <T>(_tenantId: string, fn: (m: typeof manager) => Promise<T>) => fn(manager),
  };

  const fileStorage = {
    async deleteObject(key: string) {
      deleted.push(key);
    },
  };

  const service = new TourClonePendingStorageService(
    tenantDbContext as never,
    { error: () => undefined } as never,
  );
  await service.releaseCloneOperation("tenant-1", "op-1", { fileStorage: fileStorage as never });

  assert.deepEqual(deleted, [
    "tenant-1/tours/new/photos/a.jpg",
    "tenant-1/tours/new/photos/b.jpg",
  ]);
});

test("releaseCloneOperation does not delete objects when destinationTourId is set", async () => {
  let deleteCalls = 0;

  const manager = {
    async find() {
      return [
        {
          objectKey: "tenant-1/tours/new/photos/a.jpg",
          cloneOperationId: "op-1",
          tenantId: "tenant-1",
          status: PendingStorageDeletionStatus.PENDING,
        },
      ];
    },
    async update() {
      return undefined;
    },
    async delete() {
      return undefined;
    },
  };

  const tenantDbContext = {
    runInTenantScope: async <T>(_tenantId: string, fn: (m: typeof manager) => Promise<T>) => fn(manager),
  };

  const fileStorage = {
    async deleteObject() {
      deleteCalls += 1;
    },
  };

  const service = new TourClonePendingStorageService(
    tenantDbContext as never,
    { error: () => undefined } as never,
  );
  await service.releaseCloneOperation("tenant-1", "op-1", {
    destinationTourId: "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22",
    fileStorage: fileStorage as never,
  });

  assert.equal(deleteCalls, 0);
});

test("releaseCloneOperation records destinationTourId when clone persist succeeded", async () => {
  const updates: unknown[] = [];

  const manager = {
    async update(_entity: unknown, _criteria: unknown, patch: unknown) {
      updates.push(patch);
    },
    async delete() {
      return undefined;
    },
  };

  const tenantDbContext = {
    runInTenantScope: async <T>(_tenantId: string, fn: (m: typeof manager) => Promise<T>) => fn(manager),
  };

  const service = new TourClonePendingStorageService(
    tenantDbContext as never,
    { error: () => undefined } as never,
  );
  const destinationTourId = "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22";
  await service.releaseCloneOperation("tenant-1", "op-1", { destinationTourId });

  assert.deepEqual(updates, [
    {
      status: PendingStorageDeletionStatus.COMMITTED,
      destinationTourId,
    },
  ]);
});
