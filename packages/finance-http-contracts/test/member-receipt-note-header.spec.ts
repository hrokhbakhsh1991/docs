import assert from "node:assert/strict";
import test from "node:test";

import {
  decodeMemberReceiptNoteHeader,
  encodeMemberReceiptNoteHeader,
  MEMBER_RECEIPT_NOTE_HEADER_PREFIX,
} from "../src/member-receipt-note-header";

test("member receipt note header round-trips Persian, emoji, and percent characters", () => {
  for (const note of ["رسید پرداخت", "رسید 🏔️", "مبلغ 10% و کد A%20B"]) {
    const encoded = encodeMemberReceiptNoteHeader(note);
    assert.match(encoded, /^[\x00-\x7f]+$/);
    assert.equal(decodeMemberReceiptNoteHeader(encoded), note);
  }
});

test("member receipt note header keeps legacy ASCII values and rejects malformed encoded values", () => {
  assert.equal(
    decodeMemberReceiptNoteHeader("payment reference ABC-123"),
    "payment reference ABC-123"
  );
  assert.equal(decodeMemberReceiptNoteHeader(null), null);
  assert.equal(decodeMemberReceiptNoteHeader(`${MEMBER_RECEIPT_NOTE_HEADER_PREFIX}%%%`), null);
});
