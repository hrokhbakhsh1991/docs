/**
 * SK4.D — tenant-path-isolation ACL + TenantObjectStoragePort.
 *
 * Port/ACL proofs use in-memory storage only (no MinIO). Live MinIO adapters are
 * covered by minio-photo / tenant-branding-minio suites with honest skip.
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  assertTenantOwnsObjectKey,
  TENANT_OBJECT_KEY_SCOPE_INVALID,
} from "../src/storage/assert-tenant-object-key-scope";
import { setTenantObjectStorageForTests } from "../src/storage/create-tenant-object-storage";
import type { TenantObjectStoragePort } from "../src/storage/tenant-object-storage.port";

const TENANT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TENANT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const USER_A = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function createMemoryObjectStorage(): TenantObjectStoragePort & {
  readonly objects: Map<string, { body: Buffer; contentType: string }>;
} {
  const objects = new Map<string, { body: Buffer; contentType: string }>();
  return {
    objects,
    async put(input) {
      assertTenantOwnsObjectKey(input.storageKey, input.tenantId);
      objects.set(input.storageKey, { body: input.body, contentType: input.contentType });
    },
    async getSignedReadUrl(input) {
      assertTenantOwnsObjectKey(input.storageKey, input.tenantId);
      if (!objects.has(input.storageKey)) {
        throw new Error("OBJECT_NOT_FOUND");
      }
      return `memory://signed/${input.tenantId}/${encodeURIComponent(input.storageKey)}`;
    },
    async remove(input) {
      assertTenantOwnsObjectKey(input.storageKey, input.tenantId);
      objects.delete(input.storageKey);
    },
  };
}

describe("tenant-object-storage-sk4.spec.ts", () => {
  afterEach(() => {
    setTenantObjectStorageForTests(undefined);
  });

  it("SK4-OBJ-01 branding key ownership", () => {
    assert.doesNotThrow(() => assertTenantOwnsObjectKey(`${TENANT_A}/branding/logo`, TENANT_A));
    assert.throws(
      () => assertTenantOwnsObjectKey(`${TENANT_B}/branding/logo`, TENANT_A),
      (error: unknown) =>
        error instanceof Error && error.message === TENANT_OBJECT_KEY_SCOPE_INVALID
    );
  });

  it("SK4-OBJ-02 operator avatar key ownership", () => {
    const key = `${TENANT_A}/operators/${USER_A}/avatar`;
    assert.doesNotThrow(() => assertTenantOwnsObjectKey(key, TENANT_A));
    assert.throws(
      () => assertTenantOwnsObjectKey(key, TENANT_B),
      (error: unknown) =>
        error instanceof Error && error.message === TENANT_OBJECT_KEY_SCOPE_INVALID
    );
  });

  it("SK4-OBJ-03 branding + receipt families share port (no cross-tenant put)", async () => {
    const memory = createMemoryObjectStorage();
    setTenantObjectStorageForTests(memory);

    const brandKey = `${TENANT_A}/branding/logo`;
    await memory.put({
      tenantId: TENANT_A,
      storageKey: brandKey,
      body: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
      contentType: "image/jpeg",
    });

    const receiptKey = `receipts/${TENANT_A}/00000000-0000-4000-8000-000000000501/proof.pdf`;
    await memory.put({
      tenantId: TENANT_A,
      storageKey: receiptKey,
      body: Buffer.from("%PDF-1.4"),
      contentType: "application/pdf",
    });
    assert.ok(receiptKey.startsWith(`receipts/${TENANT_A}/`));
    assert.equal(memory.objects.size, 2);

    await assert.rejects(
      () =>
        memory.put({
          tenantId: TENANT_A,
          storageKey: `${TENANT_B}/branding/logo`,
          body: Buffer.from("x"),
          contentType: "image/png",
        }),
      (error: unknown) =>
        error instanceof Error && error.message === TENANT_OBJECT_KEY_SCOPE_INVALID
    );
  });

  it("SK4-OBJ-04 signed read refuses foreign tenant key", async () => {
    const memory = createMemoryObjectStorage();
    setTenantObjectStorageForTests(memory);
    const key = `${TENANT_A}/operators/${USER_A}/avatar`;
    await memory.put({
      tenantId: TENANT_A,
      storageKey: key,
      body: Buffer.from("avatar"),
      contentType: "image/png",
    });
    await assert.rejects(
      () =>
        memory.getSignedReadUrl({
          tenantId: TENANT_B,
          storageKey: key,
        }),
      (error: unknown) =>
        error instanceof Error && error.message === TENANT_OBJECT_KEY_SCOPE_INVALID
    );
  });

  it("SK4-OBJ-05 operator avatar key family uses shared port ACL", async () => {
    const memory = createMemoryObjectStorage();
    setTenantObjectStorageForTests(memory);

    const storageKey = `${TENANT_A}/operators/${USER_A}/avatar`;
    await memory.put({
      tenantId: TENANT_A,
      storageKey,
      body: Buffer.alloc(16, 0xff),
      contentType: "image/jpeg",
    });
    assert.ok(memory.objects.has(storageKey));
  });
});
