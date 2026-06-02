import assert from "node:assert/strict";
import test from "node:test";
import { StorageHealthService } from "../../src/infra/storage/storage-health.service";
import type { MinioStorageAdapter } from "../../src/infra/storage/minio-storage.adapter";

test("StorageHealthService returns skipped in test NODE_ENV", async () => {
  const prev = process.env.NODE_ENV;
  process.env.NODE_ENV = "test";
  try {
    const service = new StorageHealthService({ ping: async () => ({ ok: true, bucket: "receipts" }) } as MinioStorageAdapter);
    const snap = await service.check();
    assert.equal(snap.status, "skipped");
  } finally {
    process.env.NODE_ENV = prev;
  }
});

test("StorageHealthService reports ok when MinIO ping succeeds", async () => {
  const prev = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";
  try {
    const service = new StorageHealthService({
      ping: async () => ({ ok: true, bucket: "receipts" })
    } as MinioStorageAdapter);
    const snap = await service.check();
    assert.equal(snap.status, "ok");
    assert.equal(snap.bucket, "receipts");
  } finally {
    process.env.NODE_ENV = prev;
  }
});

test("StorageHealthService reports unavailable when bucket missing", async () => {
  const prev = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";
  try {
    const service = new StorageHealthService({
      ping: async () => ({ ok: false, bucket: "receipts", reason: "bucket_missing" })
    } as MinioStorageAdapter);
    const snap = await service.check();
    assert.equal(snap.status, "unavailable");
    assert.equal(snap.reason, "bucket_missing");
  } finally {
    process.env.NODE_ENV = prev;
  }
});
