/**
 * Ticketing E2E — in-memory TenantObjectStoragePort (no MinIO required).
 * Loaded via `node --import ./scripts/e2e-memory-object-storage.ts`.
 */
import assert from "node:assert/strict";

import { assertTenantOwnsObjectKey } from "../src/storage/assert-tenant-object-key-scope";
import { setTenantObjectStorageForTests } from "../src/storage/create-tenant-object-storage";
import type { TenantObjectStoragePort } from "../src/storage/tenant-object-storage.port";

function createMemoryObjectStorage(): TenantObjectStoragePort {
  const objects = new Map<string, { body: Buffer; contentType: string }>();
  return {
    async put(input) {
      assertTenantOwnsObjectKey(input.storageKey, input.tenantId);
      objects.set(input.storageKey, { body: input.body, contentType: input.contentType });
    },
    async getSignedReadUrl(input) {
      assertTenantOwnsObjectKey(input.storageKey, input.tenantId);
      assert.ok(objects.has(input.storageKey), "OBJECT_NOT_FOUND");
      return `memory://signed/${input.tenantId}/${encodeURIComponent(input.storageKey)}`;
    },
    async remove(input) {
      assertTenantOwnsObjectKey(input.storageKey, input.tenantId);
      objects.delete(input.storageKey);
    },
  };
}

if (process.env.TICKETING_E2E_MEMORY_STORAGE === "1") {
  setTenantObjectStorageForTests(createMemoryObjectStorage());
}
