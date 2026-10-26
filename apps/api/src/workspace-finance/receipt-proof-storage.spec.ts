import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, test } from "node:test";

import {
  deleteMemberReceiptProof,
  getMemberReceiptProofSignedReadUrl,
  MEMBER_RECEIPT_PROOF_MAX_BYTES,
  putMemberReceiptProof,
  readMemberReceiptProof,
} from "./receipt-proof-storage";

const envKeys = [
  "STORAGE_DRIVER",
  "NODE_ENV",
  "PORT",
  "MINIO_ENDPOINT",
  "MINIO_ACCESS_KEY",
  "MINIO_SECRET_KEY",
  "MINIO_BUCKET",
] as const;
const savedEnv = new Map<string, string | undefined>();

beforeEach(() => {
  for (const key of envKeys) savedEnv.set(key, process.env[key]);
  process.env.STORAGE_DRIVER = "memory";
  process.env.NODE_ENV = "test";
  process.env.PORT = "3001";
  // Keep these tests deterministic and ensure they can never reach an object store.
  delete process.env.MINIO_ENDPOINT;
  delete process.env.MINIO_ACCESS_KEY;
  delete process.env.MINIO_SECRET_KEY;
  delete process.env.MINIO_BUCKET;
});

afterEach(() => {
  for (const key of envKeys) {
    const value = savedEnv.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  savedEnv.clear();
});

test("receipt proof can be uploaded, read, signed for local access, and deleted", async () => {
  const tenantId = randomUUID();
  const registrationId = randomUUID();
  const original = Buffer.from("fake-pdf-proof");
  const { storageKey } = await putMemberReceiptProof({
    tenantId,
    registrationId,
    body: original,
    contentType: "application/pdf; charset=binary",
    fileName: "../receipt.pdf",
  });

  original.fill(0);
  assert.match(
    storageKey,
    new RegExp(`^receipts/${tenantId}/${registrationId}/receipt-[a-f0-9]{32}\\.pdf$`)
  );
  const read = await readMemberReceiptProof({ tenantId, storageKey });
  assert.deepEqual(read.body, Buffer.from("fake-pdf-proof"));
  assert.equal(read.contentType, "application/pdf");
  assert.equal(read.fileName, "receipt.pdf");
  assert.equal(
    await getMemberReceiptProofSignedReadUrl({ tenantId, storageKey }),
    `http://127.0.0.1:3001/internal/dev/receipt-proof/${encodeURIComponent(storageKey)}`
  );

  await deleteMemberReceiptProof({ tenantId, storageKey });
  await assert.rejects(
    readMemberReceiptProof({ tenantId, storageKey }),
    /RECEIPT_STORAGE_UNAVAILABLE/
  );
});

test("receipt proof is idempotent for identical bytes and returns defensive copies", async () => {
  const tenantId = randomUUID();
  const registrationId = randomUUID();
  const input = {
    tenantId,
    registrationId,
    body: Buffer.from("same-content"),
    contentType: "image/png",
    fileName: "proof.png",
  };
  const first = await putMemberReceiptProof(input);
  const second = await putMemberReceiptProof(input);
  assert.equal(second.storageKey, first.storageKey);

  const firstRead = await readMemberReceiptProof({ tenantId, storageKey: first.storageKey });
  firstRead.body.fill(0);
  const secondRead = await readMemberReceiptProof({ tenantId, storageKey: first.storageKey });
  assert.deepEqual(secondRead.body, Buffer.from("same-content"));
});

test("receipt proof rejects unsupported types, empty payloads, and payloads over the limit", async () => {
  const common = { tenantId: randomUUID(), registrationId: randomUUID(), fileName: "proof.pdf" };
  await assert.rejects(
    putMemberReceiptProof({ ...common, body: Buffer.from("x"), contentType: "text/plain" }),
    /RECEIPT_PROOF_CONTENT_TYPE_INVALID/
  );
  await assert.rejects(
    putMemberReceiptProof({ ...common, body: Buffer.alloc(0), contentType: "application/pdf" }),
    /RECEIPT_PROOF_EMPTY/
  );
  await assert.rejects(
    putMemberReceiptProof({
      ...common,
      body: Buffer.alloc(MEMBER_RECEIPT_PROOF_MAX_BYTES + 1),
      contentType: "application/pdf",
    }),
    /RECEIPT_PROOF_TOO_LARGE/
  );
});

test("receipt proof reads and deletes are tenant-scoped", async () => {
  const tenantId = randomUUID();
  const { storageKey } = await putMemberReceiptProof({
    tenantId,
    registrationId: randomUUID(),
    body: Buffer.from("proof"),
    contentType: "image/jpeg",
    fileName: "proof.jpg",
  });

  await assert.rejects(
    readMemberReceiptProof({ tenantId: randomUUID(), storageKey }),
    /RECEIPT_PROOF_KEY_SCOPE_INVALID/
  );
  await assert.rejects(
    deleteMemberReceiptProof({ tenantId: randomUUID(), storageKey }),
    /RECEIPT_PROOF_KEY_SCOPE_INVALID/
  );
  assert.deepEqual(
    (await readMemberReceiptProof({ tenantId, storageKey })).body,
    Buffer.from("proof")
  );
});

test("memory receipt storage stays disabled in production and when no driver is configured", async () => {
  const input = {
    tenantId: randomUUID(),
    registrationId: randomUUID(),
    body: Buffer.from("proof"),
    contentType: "application/pdf",
    fileName: "proof.pdf",
  };
  process.env.NODE_ENV = "production";
  await assert.rejects(putMemberReceiptProof(input), /MINIO_NOT_CONFIGURED/);

  process.env.NODE_ENV = "test";
  delete process.env.STORAGE_DRIVER;
  await assert.rejects(putMemberReceiptProof(input), /MINIO_NOT_CONFIGURED/);
});
