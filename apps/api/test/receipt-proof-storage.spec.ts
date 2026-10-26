import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildMemberReceiptProofObjectKey,
  rethrowMemberReceiptProofStorageError,
} from "../src/workspace-finance/receipt-proof-storage";

describe("receipt proof storage error mapping", () => {
  it("maps transient DNS failures to a stable storage-unavailable error", () => {
    assert.throws(
      () => rethrowMemberReceiptProofStorageError(new Error("getaddrinfo EAI_AGAIN minio")),
      { message: "RECEIPT_STORAGE_UNAVAILABLE" }
    );
  });

  it("keeps a supported image or PDF extension at the end of the content-addressed object key", () => {
    const contentHash = "0123456789abcdef0123456789abcdef";
    for (const extension of ["png", "jpg", "jpeg", "webp", "gif", "pdf"]) {
      const key = buildMemberReceiptProofObjectKey({
        tenantId: "tenant-test",
        registrationId: "registration-test",
        fileName: `receipt.${extension}`,
        contentHash,
      });
      assert.ok(key.endsWith(`receipt-${contentHash}.${extension}`), key);
    }
  });
});
