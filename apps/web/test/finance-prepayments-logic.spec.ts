/**
 * Phase 9.7 R2 — prepayments panel logic (REQ-P9-073 · CP-9.7-10).
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";

import {
  buildRecordPrepaymentRequestBody,
  formatMinorAmount,
  formatPrepaymentRecordedAt,
  parsePrepaymentsListResponse,
  validateRecordPrepaymentForm,
} from "../src/finance/finance-prepayments-logic";

describe("finance-prepayments-logic.spec.ts — Phase 9.7 R2", () => {
  it("WEB-9.7-R2-01 parsePrepaymentsListResponse normalizes items", () => {
    const registrationId = randomUUID();
    const parsed = parsePrepaymentsListResponse({
      items: [
        {
          id: "evt-1",
          registrationId,
          amountMinor: "1000000",
          currency: "IRR",
          method: "Manual",
          note: null,
          recordedAt: "2026-06-09T12:00:00.000Z",
        },
      ],
    });
    assert.equal(parsed.items.length, 1);
    assert.equal(parsed.items[0]?.registrationId, registrationId);
    assert.equal(parsed.items[0]?.amountMinor, "1000000");
  });

  it("WEB-9.7-R2-02 validateRecordPrepaymentForm rejects invalid UUID", () => {
    const result = validateRecordPrepaymentForm({
      registrationId: "not-a-uuid",
      amountMinor: "1000",
      currency: "IRR",
      method: "Manual",
      note: "",
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error, "REGISTRATION_ID_INVALID");
    }
  });

  it("WEB-9.7-R2-03 validateRecordPrepaymentForm accepts valid payload", () => {
    const registrationId = randomUUID();
    const result = validateRecordPrepaymentForm({
      registrationId,
      amountMinor: "5000000",
      currency: "irr",
      method: "BankTransfer",
      note: "deposit",
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.value.currency, "IRR");
      const body = buildRecordPrepaymentRequestBody(result.value);
      assert.equal(body.registrationId, registrationId);
      assert.equal(body.note, "deposit");
    }
  });

  it("WEB-9.7-R2-04 formatMinorAmount groups digits", () => {
    assert.equal(formatMinorAmount("5000000", "IRR"), "5,000,000 IRR");
    assert.match(formatMinorAmount("5000000", "IRR", "fa"), /۵/);
  });

  it("WEB-9.7-R2-05 formatPrepaymentRecordedAt localizes timestamp", () => {
    assert.equal(formatPrepaymentRecordedAt("not-a-date"), "not-a-date");
    const formattedEn = formatPrepaymentRecordedAt("2026-06-09T12:00:00.000Z", "en");
    assert.match(formattedEn, /2026/);
    const formattedFa = formatPrepaymentRecordedAt("2026-06-09T12:00:00.000Z", "fa");
    assert.notEqual(formattedFa, formattedEn);
  });
});
