import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { rethrowMemberReceiptProofStorageError } from "../src/workspace-finance/receipt-proof-storage";

describe("receipt proof storage error mapping", () => {
  it("maps transient DNS failures to a stable storage-unavailable error", () => {
    assert.throws(
      () => rethrowMemberReceiptProofStorageError(new Error("getaddrinfo EAI_AGAIN minio")),
      { message: "RECEIPT_STORAGE_UNAVAILABLE" }
    );
  });
});
