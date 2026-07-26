/**
 * SK4.D — tenant-path-isolation ACL + TenantObjectStoragePort.
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  assertTenantOwnsObjectKey,
  TENANT_OBJECT_KEY_SCOPE_INVALID,
} from "../src/storage/assert-tenant-object-key-scope";
import { setTenantObjectStorageForTests } from "../src/storage/create-tenant-object-storage";
import type { TenantObjectStoragePort } from "../src/storage/tenant-object-storage.port";
import { putMemberReceiptProof } from "../src/workspace-finance/receipt-proof-storage";
import { putOperatorAvatar } from "../src/identity/operator-avatar-storage";

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

describe("tenant-object-storage-sk4.spec.ts — SK4.D", () => {
  afterEach(() => {
    setTenantObjectStorageForTests(null);
  });

  it("SK4-OBJ-01 ACL accepts tenant-owned key shapes", async () => {
    assert.doesNotThrow(() =>
      assertTenantOwnsObjectKey(`${TENANT_A}/branding/logo`, TENANT_A)
    );
    assert.doesNotThrow(() =>
      assertTenantOwnsObjectKey(`${TENANT_A}/operators/${USER_A}/avatar`, TENANT_A)
    );
    assert.doesNotThrow(() =>
      assertTenantOwnsObjectKey(`receipts/${TENANT_A}/reg-1/proof.pdf`, TENANT_A)
    );
  });

  it("SK4-OBJ-02 ACL rejects cross-tenant and traversal keys", async () => {
    assert.throws(
      () => assertTenantOwnsObjectKey(`${TENANT_B}/branding/logo`, TENANT_A),
      (error: unknown) =>
        error instanceof Error && error.message === TENANT_OBJECT_KEY_SCOPE_INVALID
    );
    assert.throws(
      () => assertTenantOwnsObjectKey(`receipts/${TENANT_B}/r/x.bin`, TENANT_A),
      (error: unknown) =>
        error instanceof Error && error.message === TENANT_OBJECT_KEY_SCOPE_INVALID
    );
    assert.throws(
      () => assertTenantOwnsObjectKey(`${TENANT_A}/../${TENANT_B}/x`, TENANT_A),
      (error: unknown) =>
        error instanceof Error && error.message === TENANT_OBJECT_KEY_SCOPE_INVALID
    );
  });

  it("SK4-OBJ-03 branding + receipt families share port (no cross-tenant put)", async () => {
    const memory = createMemoryObjectStorage();
    setTenantObjectStorageForTests(memory);

    // Minimal valid JPEG SOI + EOI for brand logo sniff when content-type jpeg —
    // branding path uses byte sniff; use a tiny PNG-like buffer may fail sniff.
    // Prefer going through port directly for branding key write, and receipt via putMemberReceiptProof.
    const brandKey = `${TENANT_A}/branding/logo`;
    await memory.put({
      tenantId: TENANT_A,
      storageKey: brandKey,
      body: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
      contentType: "image/jpeg",
    });

    const receipt = await putMemberReceiptProof({
      tenantId: TENANT_A,
      registrationId: "00000000-0000-4000-8000-000000000501",
      body: Buffer.from("%PDF-1.4"),
      contentType: "application/pdf",
      fileName: "proof.pdf",
    });
    assert.ok(receipt.storageKey.startsWith(`receipts/${TENANT_A}/`));
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

  it("SK4-OBJ-05 putOperatorAvatar uses shared port ACL", async () => {
    const memory = createMemoryObjectStorage();
    setTenantObjectStorageForTests(memory);

    // JPEG magic + padding — sniff requires length >= 12
    const jpeg = Buffer.alloc(16, 0);
    jpeg[0] = 0xff;
    jpeg[1] = 0xd8;
    jpeg[2] = 0xff;
    const { storageKey } = await putOperatorAvatar({
      tenantId: TENANT_A,
      userId: USER_A,
      body: jpeg,
      contentType: "image/jpeg",
    });
    assert.equal(storageKey, `${TENANT_A}/operators/${USER_A}/avatar`);
    assert.ok(memory.objects.has(storageKey));
  });
});
