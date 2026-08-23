/**
 * PR23-E3 — refund operator UI logic tests.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  financeRefundsLogicForbidsClientMoneyMath,
  mapRefundMutationHttpError,
  parseFinanceRefundsResponse,
  refundActionsForStatus,
  sanitizeFinanceRefundHref,
} from "../src/finance/finance-refunds-logic.ts";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("finance-refunds-pr23e3", () => {
  it("parses refund list page", () => {
    const page = parseFinanceRefundsResponse({
      items: [
        {
          id: "r1",
          registrationId: "reg-1",
          paymentId: "pay-1",
          sourceKind: "payment",
          amountMinor: "30000000",
          currency: "IRR",
          reasonCode: "overpayment",
          reasonNote: null,
          status: "Requested",
          requestedAt: "2026-08-09T10:00:00.000Z",
          approvedAt: null,
          completedAt: null,
          rejectedAt: null,
          cancelledAt: null,
          evidenceFileKey: null,
          identity: {
            memberDisplayName: "Ada",
            tourTitle: "Peak",
            tourId: "tour-1",
          },
          invoice: {
            totalMinor: "100000000",
            paidMinor: "100000000",
            remainingMinor: "0",
            refundedMinor: "0",
            currency: "IRR",
          },
          linkedPayment: {
            id: "pay-1",
            amount: "100000000",
            currency: "IRR",
            status: "Paid",
            method: "Manual",
          },
          href: {
            payments: "/finance?tab=payments&registrationId=reg-1",
            receipts: "/finance?tab=receipts&registrationId=reg-1",
          },
        },
      ],
      nextCursor: null,
      hasMore: false,
    });
    assert.equal(page.items.length, 1);
    assert.equal(page.items[0]?.status, "Requested");
    assert.equal(page.items[0]?.invoice?.refundedMinor, "0");
    assert.equal(page.items[0]?.linkedPayment?.status, "Paid");
  });

  it("renders action visibility by lifecycle", () => {
    assert.deepEqual(refundActionsForStatus("Requested"), {
      approve: true,
      complete: true,
      reject: true,
      cancel: true,
    });
    assert.deepEqual(refundActionsForStatus("Approved"), {
      approve: false,
      complete: true,
      reject: true,
      cancel: true,
    });
    assert.deepEqual(refundActionsForStatus("Completed"), {
      approve: false,
      complete: false,
      reject: false,
      cancel: false,
    });
  });

  it("maps server cap / transition errors", () => {
    assert.equal(mapRefundMutationHttpError(409, { code: "REFUND_OVER_CAP" }), "REFUND_OVER_CAP");
    assert.equal(
      mapRefundMutationHttpError(409, { code: "REFUND_NOT_TRANSITIONABLE" }),
      "REFUND_NOT_TRANSITIONABLE"
    );
    assert.equal(mapRefundMutationHttpError(404, { code: "REFUND_NOT_FOUND" }), "REFUND_NOT_FOUND");
  });

  it("sanitizes finance hrefs only", () => {
    assert.equal(
      sanitizeFinanceRefundHref("/finance?tab=payments&registrationId=x"),
      "/finance?tab=payments&registrationId=x"
    );
    assert.equal(sanitizeFinanceRefundHref("https://evil.example/finance"), null);
  });

  it("logic forbids client money arithmetic", () => {
    const logic = readFileSync(resolve(WEB_ROOT, "src/finance/finance-refunds-logic.ts"), "utf8");
    assert.equal(financeRefundsLogicForbidsClientMoneyMath(logic), true);
  });

  it("panel wires Complete / reject / cancel without PSP", () => {
    const panel = readFileSync(resolve(WEB_ROOT, "src/finance/finance-refunds-panel.tsx"), "utf8");
    assert.match(panel, /\/api\/finance\/refunds\/\$\{item\.id\}\/complete/);
    assert.match(panel, /\/api\/finance\/refunds\/\$\{item\.id\}\/reject/);
    assert.match(panel, /\/api\/finance\/refunds\/\$\{item\.id\}\/cancel/);
    assert.doesNotMatch(panel, /psp|stripe|gateway|chargeback/i);
    assert.doesNotMatch(panel, /walletNet|refundableRemaining/);
  });

  it("refund prefill preview uses payment currency instead of inventing IRR", () => {
    const panel = readFileSync(resolve(WEB_ROOT, "src/finance/finance-refunds-panel.tsx"), "utf8");
    const payments = readFileSync(
      resolve(WEB_ROOT, "src/finance/finance-payments-panel.tsx"),
      "utf8"
    );

    assert.match(payments, /currency=\$\{encodeURIComponent\(row\.currency\)\}/);
    assert.match(panel, /searchParams\.get\("currency"\)/);
    assert.match(panel, /formatMinorAmount\(reqAmount\.trim\(\), currencyPrefill, locale\)/);
    assert.doesNotMatch(panel, /formatMinorAmount\(reqAmount\.trim\(\), "IRR", locale\)/);
  });

  it("FA/EN refund vocabulary distinct from payment Pending", () => {
    const en = JSON.parse(readFileSync(resolve(WEB_ROOT, "messages/en/finance.json"), "utf8")) as {
      refunds: Record<string, string>;
    };
    const fa = JSON.parse(readFileSync(resolve(WEB_ROOT, "messages/fa/finance.json"), "utf8")) as {
      refunds: Record<string, string>;
    };
    assert.equal(en.refunds.statusRequested, "Requested");
    assert.equal(en.refunds.statusCompleted, "Completed");
    assert.equal(fa.refunds.statusRequested, "درخواست‌شده");
    assert.equal(fa.refunds.statusCompleted, "تکمیل‌شده");
    assert.notEqual(en.refunds.statusRequested, "Pending");
  });

  it("command center mounts refunds tab", () => {
    const shell = readFileSync(
      resolve(WEB_ROOT, "app/(app)/finance/finance-command-center.tsx"),
      "utf8"
    );
    assert.match(shell, /FinanceRefundsPanel/);
    assert.match(shell, /activeTab === "refunds"/);
  });
});
