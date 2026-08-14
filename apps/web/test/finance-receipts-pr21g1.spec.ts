/**
 * PR21-G1 — Receipts loading vs true empty vs error (presentation).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import { FINANCE_RECEIPTS_TEST_IDS } from "../src/finance/finance-receipts-logic.ts";

const WEB_ROOT = join(process.cwd());
const panel = readFileSync(join(WEB_ROOT, "src/finance/finance-receipts-panel.tsx"), "utf8");
const review = readFileSync(
  join(WEB_ROOT, "src/finance/finance-receipt-review-content.tsx"),
  "utf8"
);
const EN = JSON.parse(readFileSync(join(WEB_ROOT, "messages/en/finance.json"), "utf8")) as {
  receipts: Record<string, string>;
};
const FA = JSON.parse(readFileSync(join(WEB_ROOT, "messages/fa/finance.json"), "utf8")) as {
  receipts: Record<string, string>;
};

describe("PR21-G1 Receipts state clarity", () => {
  it("exposes distinct loading / empty / list test ids", () => {
    assert.equal(FINANCE_RECEIPTS_TEST_IDS.loading, "finance-receipts-loading");
    assert.equal(FINANCE_RECEIPTS_TEST_IDS.empty, "finance-receipts-empty");
    assert.equal(FINANCE_RECEIPTS_TEST_IDS.emptyOpenPayments, "finance-receipts-empty-open-payments");
    assert.match(panel, /FINANCE_RECEIPTS_TEST_IDS\.loading/);
    assert.match(panel, /FINANCE_RECEIPTS_TEST_IDS\.empty/);
    assert.match(panel, /FINANCE_RECEIPTS_TEST_IDS\.list/);
  });

  it("uses explicit load phase: loading | ready | error", () => {
    assert.match(panel, /type ReceiptsLoadPhase = "loading" \| "ready" \| "error"/);
    assert.match(panel, /setPhase\("loading"\)/);
    assert.match(panel, /setPhase\("ready"\)/);
    assert.match(panel, /setPhase\("error"\)/);
    assert.match(panel, /phase === "loading"/);
    assert.match(panel, /phase === "ready" && items\.length === 0/);
    assert.match(panel, /phase === "error"/);
  });

  it("true empty is not shown while loading; error is not empty", () => {
    assert.doesNotMatch(panel, /phase === "loading"[\s\S]{0,200}FINANCE_RECEIPTS_TEST_IDS\.empty/);
    // empty only when ready + length 0
    assert.match(panel, /phase === "ready" && items\.length === 0/);
    // error branch separate
    assert.match(panel, /phase === "error" && error !== null/);
  });

  it("initial phase is loading when no prefetch; ready when prefetched", () => {
    assert.match(panel, /initialReceipts === null \? "loading" : "ready"/);
  });

  it("empty state offers Payments next surface with registration helper", () => {
    assert.match(panel, /emptyOpenPayments/);
    assert.match(panel, /withFinanceRegistrationQuery/);
    assert.match(panel, /\/finance\?tab=payments/);
    assert.equal(EN.receipts.empty, "No receipts awaiting review.");
    assert.match(EN.receipts.emptyOpenPayments, /Open payments/i);
    assert.equal(FA.receipts.empty, "فیشی در انتظار بررسی نیست.");
    assert.match(FA.receipts.emptyOpenPayments, /باز کردن پرداخت/);
    assert.doesNotMatch(EN.receipts.emptyNextHint, /member must upload/i);
  });

  it("non-empty path still renders review list (PR21-D preserved)", () => {
    assert.match(panel, /FinanceReceiptReviewContent/);
    assert.match(panel, /FINANCE_RECEIPTS_TEST_IDS\.list/);
    assert.match(review, /approveConsequence|afterApprovePreview|proofToggle/);
  });
});
