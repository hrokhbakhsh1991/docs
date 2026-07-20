import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { submitBinaryMemberReceiptAfterOwnership } from "./submit-binary-member-receipt-after-ownership";

const here = dirname(fileURLToPath(import.meta.url));

describe("MR-P0-010 receipt upload authz before object storage", () => {
  it("helper: putProof is not called when ownership fails", async () => {
    let putCalls = 0;
    await assert.rejects(
      () =>
        submitBinaryMemberReceiptAfterOwnership({
          assertOwns: async () => {
            throw new Error("BOOKINGS_FORBIDDEN");
          },
          putProof: async () => {
            putCalls += 1;
            return { storageKey: "should-not-exist" };
          },
          submit: async () => {
            throw new Error("submit should not run");
          },
        }),
      (error: unknown) => error instanceof Error && error.message === "BOOKINGS_FORBIDDEN"
    );
    assert.equal(putCalls, 0);
  });

  it("helper: put then submit when ownership passes", async () => {
    const result = await submitBinaryMemberReceiptAfterOwnership({
      assertOwns: async () => undefined,
      putProof: async () => ({ storageKey: "receipts/t1/r1.bin" }),
      submit: async (fileKey) => ({ ok: true, fileKey }),
    });
    assert.deepEqual(result, { ok: true, fileKey: "receipts/t1/r1.bin" });
  });

  it("bookings.routes binary path uses ownership-before-put helper", () => {
    const src = readFileSync(join(here, "bookings.routes.ts"), "utf8");
    assert.match(src, /submitBinaryMemberReceiptAfterOwnership/);
    const handler = src.slice(src.indexOf("export async function handlePostBookingReceipt"));
    const helperCall = handler.indexOf("submitBinaryMemberReceiptAfterOwnership({");
    const putInHelper = handler.indexOf("putMemberReceiptProof({");
    assert.ok(helperCall > 0, "helper must be called");
    assert.ok(putInHelper > helperCall, "putMemberReceiptProof must run inside helper callback");
  });
});
