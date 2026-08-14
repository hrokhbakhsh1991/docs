/**
 * PR23-B1 — receipt queue clarity (presentation only).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  FINANCE_RECEIPTS_TEST_IDS,
  RECEIPT_AGING_FRESH_MS,
  RECEIPT_AGING_WAITING_MS,
  RECEIPT_QUEUE_FETCH_LIMIT,
  receiptAgeMs,
  resolveReceiptAgingBand,
  resolveReceiptAgingBandFromCreatedAt,
  resolveReceiptQueueHonesty,
  resolveReceiptWaitRelative,
} from "../src/finance/finance-receipts-logic.ts";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = resolve(WEB_ROOT, "../..");
const NOW = new Date("2026-08-09T12:00:00.000Z");

function isoAgo(ms: number): string {
  return new Date(NOW.getTime() - ms).toISOString();
}

describe("finance-receipts queue clarity PR23-B1", () => {
  it("B1-A — fresh band when age < 4h", () => {
    const createdAt = isoAgo(RECEIPT_AGING_FRESH_MS - 60_000);
    assert.equal(resolveReceiptAgingBandFromCreatedAt(createdAt, NOW), "fresh");
    const age = receiptAgeMs(createdAt, NOW);
    assert.ok(age !== null && age < RECEIPT_AGING_FRESH_MS);
  });

  it("B1-B — longer band when age >= 48h", () => {
    const createdAt = isoAgo(RECEIPT_AGING_WAITING_MS);
    assert.equal(resolveReceiptAgingBandFromCreatedAt(createdAt, NOW), "longer");
    assert.equal(resolveReceiptAgingBand(RECEIPT_AGING_WAITING_MS), "longer");
  });

  it("B1-C — waiting band when 4h <= age < 48h", () => {
    const createdAt = isoAgo(RECEIPT_AGING_FRESH_MS);
    assert.equal(resolveReceiptAgingBandFromCreatedAt(createdAt, NOW), "waiting");
    const mid = isoAgo(24 * 60 * 60 * 1000);
    assert.equal(resolveReceiptAgingBandFromCreatedAt(mid, NOW), "waiting");
    const relative = resolveReceiptWaitRelative(mid, NOW);
    assert.ok(relative !== null);
    assert.equal(relative.unit, "hour");
    assert.equal(relative.value, -24);
  });

  it("B1-D — empty queue honesty is shown_only with 0 (panel hides meta)", () => {
    assert.deepEqual(resolveReceiptQueueHonesty({ shown: 0 }), {
      kind: "shown_only",
      shown: 0,
    });
    const panel = readFileSync(resolve(WEB_ROOT, "src/finance/finance-receipts-panel.tsx"), "utf8");
    assert.match(panel, /FINANCE_RECEIPTS_TEST_IDS\.empty/);
    assert.match(panel, /queueHonesty\.shown > 0/);
  });

  it("B1-E — loading/error regression hooks remain", () => {
    const panel = readFileSync(resolve(WEB_ROOT, "src/finance/finance-receipts-panel.tsx"), "utf8");
    assert.match(panel, /FINANCE_RECEIPTS_TEST_IDS\.loading/);
    assert.match(panel, /phase === "error"/);
    assert.match(panel, /RECEIPTS_FETCH_FAILED/);
  });

  it("B1-F — payment pending vocabulary stays isolated from aging", () => {
    const fa = JSON.parse(readFileSync(resolve(WEB_ROOT, "messages/fa/finance.json"), "utf8")) as {
      receipts: Record<string, string>;
      payments: { status?: Record<string, string>; pendingPaymentMeaning?: string };
    };
    const en = JSON.parse(readFileSync(resolve(WEB_ROOT, "messages/en/finance.json"), "utf8")) as {
      receipts: Record<string, string>;
      payments: { status?: Record<string, string>; pendingPaymentMeaning?: string };
    };
    assert.equal(fa.receipts.agingFresh, "تازه ارسال شده");
    assert.equal(fa.receipts.agingWaiting, "در انتظار بررسی");
    assert.equal(fa.receipts.agingLonger, "مدت‌دار");
    assert.equal(en.receipts.agingFresh, "Recently submitted");
    assert.equal(en.receipts.agingWaiting, "Waiting for review");
    assert.equal(en.receipts.agingLonger, "Waiting longer");
    for (const copy of [fa.receipts, en.receipts]) {
      for (const key of ["agingFresh", "agingWaiting", "agingLonger", "fifoHint", "queueMayMore"]) {
        assert.doesNotMatch(copy[key] ?? "", /\boverdue\b|\blate\b|\bfailed\b/i);
        assert.doesNotMatch(copy[key] ?? "", /ناموفق|دیرکرد|معوق/);
      }
    }
    assert.match(fa.payments.pendingPaymentMeaning ?? "", /پرداخت/);
    assert.match(en.payments.pendingPaymentMeaning ?? "", /payment/i);
    assert.notEqual(fa.receipts.agingWaiting, fa.payments.status?.Pending);
  });

  it("B1-G — no fake total when pendingTotal omitted", () => {
    assert.deepEqual(resolveReceiptQueueHonesty({ shown: 12 }), {
      kind: "shown_only",
      shown: 12,
    });
    const panel = readFileSync(resolve(WEB_ROOT, "src/finance/finance-receipts-panel.tsx"), "utf8");
    assert.match(panel, /pendingTotal/);
    assert.doesNotMatch(panel, /\/api\/finance\/reports\/summary/);
    assert.doesNotMatch(
      readFileSync(resolve(WEB_ROOT, "src/finance/finance-receipts-logic.ts"), "utf8"),
      /Date\.now\(/
    );
  });

  it("B1-H — fetch limit reached shows may-more honesty", () => {
    const honesty = resolveReceiptQueueHonesty({
      shown: RECEIPT_QUEUE_FETCH_LIMIT,
      fetchLimit: RECEIPT_QUEUE_FETCH_LIMIT,
    });
    assert.equal(honesty.kind, "shown_may_more");
    assert.equal(honesty.shown, 50);
    const withTotal = resolveReceiptQueueHonesty({
      shown: RECEIPT_QUEUE_FETCH_LIMIT,
      pendingTotal: 73,
    });
    assert.deepEqual(withTotal, {
      kind: "shown_of_total",
      shown: 50,
      total: 73,
    });
  });

  it("B1-I — FIFO hint present; no client re-sort of items", () => {
    const panel = readFileSync(resolve(WEB_ROOT, "src/finance/finance-receipts-panel.tsx"), "utf8");
    assert.match(panel, /FINANCE_RECEIPTS_TEST_IDS\.fifoHint/);
    assert.match(panel, /t\("fifoHint"\)/);
    assert.doesNotMatch(panel, /\.sort\(/);
    assert.equal(
      JSON.parse(readFileSync(resolve(WEB_ROOT, "messages/fa/finance.json"), "utf8")).receipts
        .fifoHint,
      "قدیمی‌ترین درخواست‌ها اول نمایش داده می‌شوند"
    );
    assert.equal(
      JSON.parse(readFileSync(resolve(WEB_ROOT, "messages/en/finance.json"), "utf8")).receipts
        .fifoHint,
      "Oldest requests are shown first"
    );
  });

  it("B1-J — no finance-core / FinanceService imports", () => {
    const panel = readFileSync(resolve(WEB_ROOT, "src/finance/finance-receipts-panel.tsx"), "utf8");
    const logic = readFileSync(resolve(WEB_ROOT, "src/finance/finance-receipts-logic.ts"), "utf8");
    assert.doesNotMatch(panel, /FinanceService|@app-cloud\/finance-core/);
    assert.doesNotMatch(logic, /FinanceService|@app-cloud\/finance-core/);
    assert.equal(FINANCE_RECEIPTS_TEST_IDS.agingBand, "finance-receipt-aging-band");
  });

  it("B1-K — documentation exists and forbids SLA / fake totals", () => {
    const doc = readFileSync(
      resolve(
        REPO_ROOT,
        "docs/phase-20/p7/appendices/FINANCE_RECEIPT_QUEUE_CLARITY_PR23_B1.md"
      ),
      "utf8"
    );
    assert.match(doc, /presentation hint/i);
    assert.match(doc, /not SLA|not encode SLA/i);
    assert.match(doc, /overdue|late/i);
    assert.match(doc, /Fake totals|fake backlog/i);
    assert.match(doc, /READY_FOR_REVIEW/);
    assert.match(doc, /createdAt ASC/i);
  });
});
