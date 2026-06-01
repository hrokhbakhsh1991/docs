import assert from "node:assert/strict";
import test from "node:test";

import { PendingStorageDeletionStatus } from "../../../src/modules/tours/entities/pending-storage-deletion.entity";
import {
  PENDING_STORAGE_DELETION_ORPHAN_TTL_MS,
  PendingStorageDeletionCleanupService,
  tourIdFromPendingStorageObjectKey,
} from "../../../src/modules/tours/services/pending-storage-deletion-cleanup.service";

test("tourIdFromPendingStorageObjectKey parses tour id from clone dest key", () => {
  const tourId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
  const key = `tenant-1/tours/${tourId}/photos/photo-1-tour.jpg`;
  assert.equal(tourIdFromPendingStorageObjectKey(key), tourId);
  assert.equal(tourIdFromPendingStorageObjectKey("tenant-1/other/path"), null);
});

function createQueryBuilderMock(rows: unknown[]) {
  const builder = {
    leftJoin: () => builder,
    where: () => builder,
    andWhere: () => builder,
    orderBy: () => builder,
    take: () => builder,
    getMany: async () => rows,
  };
  return builder;
}

test("cleanupOrphanedCloneObjects deletes stale pending objects only", async () => {
  const staleCreatedAt = new Date(Date.now() - PENDING_STORAGE_DELETION_ORPHAN_TTL_MS - 60_000);
  const deletedKeys: string[] = [];
  const deletedRowIds: string[] = [];

  const staleRow = {
    id: "row-1",
    tenantId: "tenant-1",
    objectKey: "tenant-1/tours/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22/photos/orphan.jpg",
    cloneOperationId: "op-1",
    destinationTourId: null,
    status: PendingStorageDeletionStatus.PENDING,
    createdAt: staleCreatedAt,
  };

  const manager = {
    createQueryBuilder: () => createQueryBuilderMock([staleRow]),
    async delete(_: unknown, criteria: { id: string }) {
      deletedRowIds.push(criteria.id);
    },
  };

  const tenantDbContext = {
    runInTenantScope: async <T>(_tenantId: string, fn: (m: typeof manager) => Promise<T>) => fn(manager),
  };

  const tenantRepository = {
    async find() {
      return [{ id: "tenant-1" }];
    },
  };

  const fileStorage = {
    async deleteObject(key: string) {
      deletedKeys.push(key);
    },
  };

  const service = new PendingStorageDeletionCleanupService(
    fileStorage as never,
    tenantDbContext as never,
    tenantRepository as never,
  );

  const result = await service.cleanupOrphanedCloneObjects();
  assert.equal(result.deletedObjects, 1);
  assert.equal(result.deletedRows, 1);
  assert.deepEqual(deletedKeys, [staleRow.objectKey]);
  assert.deepEqual(deletedRowIds, [staleRow.id]);
});

test("cleanupOrphanedCloneObjects skips rows when tours join matches destination path", async () => {
  const manager = {
    createQueryBuilder: () => createQueryBuilderMock([]),
    async delete() {
      throw new Error("delete should not run");
    },
  };

  const tenantDbContext = {
    runInTenantScope: async <T>(_tenantId: string, fn: (m: typeof manager) => Promise<T>) => fn(manager),
  };

  const tenantRepository = {
    async find() {
      return [{ id: "tenant-1" }];
    },
  };

  const fileStorage = {
    async deleteObject() {
      throw new Error("deleteObject should not run");
    },
  };

  const service = new PendingStorageDeletionCleanupService(
    fileStorage as never,
    tenantDbContext as never,
    tenantRepository as never,
  );

  const result = await service.cleanupOrphanedCloneObjects();
  assert.equal(result.deletedObjects, 0);
  assert.equal(result.deletedRows, 0);
});
