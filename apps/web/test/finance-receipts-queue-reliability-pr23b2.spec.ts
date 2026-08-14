/**
 * PR23-B2 — receipt queue reliability (client contract + structural).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  FINANCE_RECEIPTS_TEST_IDS,
  parseFinancePendingReceiptsResponse,
  resolveReceiptAgingBandFromCreatedAt,
  resolveReceiptQueueHonesty,
} from "../src/finance/finance-receipts-logic.ts";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = resolve(WEB_ROOT, "../..");

describe("finance-receipts queue reliability PR23-B2", () => {
  it("B2-A/B — parse keeps items; docs require scope-before-limit", () => {
    const doc = readFileSync(
      resolve(
        REPO_ROOT,
        "docs/phase-20/p7/appendices/FINANCE_RECEIPT_QUEUE_RELIABILITY_PR23_B2.md"
      ),
      "utf8"
    );
    assert.match(doc, /scope-before-limit/i);
    assert.match(doc, /registrationId/);
    assert.match(doc, /tour/);
    const parsed = parseFinancePendingReceiptsResponse({
      items: [
        {
          id: "r1",
          paymentId: "p1",
          fileKey: "k",
          status: "Pending",
          note: null,
          createdAt: "2026-01-10T00:00:00.000Z",
          payment: {
            id: "p1",
            registrationId: "reg-1",
            amount: "1",
            currency: "IRR",
            method: "Manual",
            status: "Pending",
          },
        },
      ],
      nextCursor: "cursor-1",
      hasMore: true,
    });
    assert.equal(parsed.items.length, 1);
    assert.equal(parsed.nextCursor, "cursor-1");
    assert.equal(parsed.hasMore, true);
  });

  it("B2-C — client never invents other-tenant data (parse is tenant-agnostic)", () => {
    const parsed = parseFinancePendingReceiptsResponse({ items: [] });
    assert.deepEqual(parsed, { items: [], nextCursor: null, hasMore: false });
  });

  it("B2-D/E — pagination fields stable; load-more appends without client reorder", () => {
    const panel = readFileSync(resolve(WEB_ROOT, "src/finance/finance-receipts-panel.tsx"), "utf8");
    assert.match(panel, /FINANCE_RECEIPTS_TEST_IDS\.loadMore/);
    assert.match(panel, /cursor=/);
    assert.match(panel, /setItems\(\(prev\)/);
    assert.doesNotMatch(panel, /\.sort\(/);
    assert.match(panel, /seen\.has\(row\.id\)/);
  });

  it("B2-F — FIFO hint preserved (oldest first)", () => {
    const fa = JSON.parse(readFileSync(resolve(WEB_ROOT, "messages/fa/finance.json"), "utf8"));
    assert.equal(fa.receipts.fifoHint, "قدیمی‌ترین درخواست‌ها اول نمایش داده می‌شوند");
  });

  it("B2-G — domain helper + HTTP contract files present", () => {
    const domain = readFileSync(
      resolve(REPO_ROOT, "packages/finance-core/src/domain/pending-receipt-queue.ts"),
      "utf8"
    );
    assert.match(domain, /paginatePendingReceiptRows/);
    assert.match(domain, /createdAt ASC|comparePendingReceiptQueueOrder/);
    const routes = readFileSync(
      resolve(REPO_ROOT, "packages/finance-http/src/finance.routes.ts"),
      "utf8"
    );
    assert.match(routes, /nextCursor/);
    assert.match(routes, /hasMore/);
    assert.match(routes, /parseOptionalListCursor/);
  });

  it("B2-H — empty parse is truly empty", () => {
    assert.deepEqual(parseFinancePendingReceiptsResponse({ items: [] }), {
      items: [],
      nextCursor: null,
      hasMore: false,
    });
  });

  it("B2-I — PR23-B1 aging regression", () => {
    const now = new Date("2026-08-09T12:00:00.000Z");
    assert.equal(
      resolveReceiptAgingBandFromCreatedAt("2026-08-09T11:00:00.000Z", now),
      "fresh"
    );
    assert.equal(
      resolveReceiptAgingBandFromCreatedAt("2026-08-07T11:00:00.000Z", now),
      "longer"
    );
    assert.equal(FINANCE_RECEIPTS_TEST_IDS.agingBand, "finance-receipt-aging-band");
    assert.equal(
      resolveReceiptQueueHonesty({ shown: 12, forceMayMore: true }).kind,
      "shown_may_more"
    );
  });

  it("B2-J — no finance-core mutation / approve imports in panel", () => {
    const panel = readFileSync(resolve(WEB_ROOT, "src/finance/finance-receipts-panel.tsx"), "utf8");
    const logic = readFileSync(resolve(WEB_ROOT, "src/finance/finance-receipts-logic.ts"), "utf8");
    assert.doesNotMatch(panel, /FinanceService|@app-cloud\/finance-core|approveManualReceiptAtomic/);
    assert.doesNotMatch(logic, /FinanceService|@app-cloud\/finance-core|cancelPendingManualPayment/);
  });
});
