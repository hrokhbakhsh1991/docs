import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveMemberReceiptNoteHeaders } from "./member-receipt-note-header";

describe("member receipt note headers", () => {
  it("decodes Persian UTF-8 note text carried in an ASCII-safe base64url header", () => {
    const note = "QA TEST ONLY — توضیح ساختگی؛ هیچ پرداخت واقعی انجام نشده.";
    const encoded = Buffer.from(note, "utf8").toString("base64url");

    assert.equal(resolveMemberReceiptNoteHeaders(encoded, ""), note);
  });

  it("keeps legacy ASCII note headers readable", () => {
    assert.equal(resolveMemberReceiptNoteHeaders("", "QA TEST ONLY"), "QA TEST ONLY");
  });

  it("rejects malformed base64url and invalid UTF-8", () => {
    assert.equal(resolveMemberReceiptNoteHeaders("bad/value", ""), null);
    assert.equal(resolveMemberReceiptNoteHeaders("_w", ""), null);
  });
});
