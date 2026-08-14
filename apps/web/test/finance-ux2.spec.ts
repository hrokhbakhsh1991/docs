/**
 * PR23 UX-2 — chrome density, Needs-action cohesion, Exception→Outstanding,
 * refund handoff + i18n (existing facts only).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  exceptionOutstandingHref,
  exceptionShowsOutstandingLink,
  FINANCE_EXCEPTION_TYPE,
} from "../src/finance/finance-exceptions-logic.ts";
import {
  refundOutstandingHref,
  refundPaymentsHref,
} from "../src/finance/finance-refunds-logic.ts";

const WEB_ROOT = resolve(process.cwd());

describe("finance UX-2 polish", () => {
  it("exception cancelled-with-balance links to Outstanding", () => {
    assert.equal(
      exceptionOutstandingHref("reg-1"),
      "/finance?tab=outstanding&registrationId=reg-1"
    );
    assert.equal(
      exceptionShowsOutstandingLink({
        id: "e1",
        type: FINANCE_EXCEPTION_TYPE.CANCELLED_PAYMENT_WITH_BALANCE,
        registrationId: "reg-1",
        identity: { memberDisplayName: null, tourTitle: null, tourId: null },
        payment: {
          id: "p1",
          amount: "1000",
          currency: "IRR",
          status: "Cancelled",
          method: "manual",
        },
        reason: null,
        balanceDueMinor: "500",
        occurredAt: "",
        href: { payments: "/finance?tab=payments&registrationId=reg-1" },
      }),
      true
    );
    assert.equal(
      exceptionShowsOutstandingLink({
        id: "e2",
        type: FINANCE_EXCEPTION_TYPE.REJECTED_RECEIPT_PENDING_PAYMENT,
        registrationId: "reg-2",
        identity: { memberDisplayName: null, tourTitle: null, tourId: null },
        payment: {
          id: "p2",
          amount: "1000",
          currency: "IRR",
          status: "Pending",
          method: "manual",
        },
        reason: null,
        balanceDueMinor: null,
        occurredAt: "",
        href: {
          payments: "/finance?tab=payments&registrationId=reg-2",
          receipts: "/finance?tab=receipts&registrationId=reg-2",
        },
      }),
      false
    );

    const panel = readFileSync(
      resolve(WEB_ROOT, "src/finance/finance-exceptions-panel.tsx"),
      "utf8"
    );
    assert.match(panel, /exceptionOutstandingHref/);
    assert.match(panel, /openOutstanding/);
  });

  it("first-customer chrome collapses state/vocab into Help", () => {
    const shell = readFileSync(
      resolve(WEB_ROOT, "app/(app)/finance/finance-command-center.tsx"),
      "utf8"
    );
    assert.match(shell, /finance-operator-help/);
    assert.match(shell, /operatorHelpSummary/);
    assert.match(shell, /finance-operator-state-guide/);
    assert.match(shell, /<details/);
  });

  it("overview Needs action: quiet empty refunds + collection queues + localized badges", () => {
    const overview = readFileSync(
      resolve(WEB_ROOT, "src/finance/finance-overview-panel.tsx"),
      "utf8"
    );
    assert.match(overview, /refundsAwaitingEmpty/);
    assert.match(overview, /collectionQueuesTitle/);
    assert.match(overview, /refundStatusI18nKey/);
    assert.doesNotMatch(overview, /refundsAwaiting\.length > 0 \?/);
  });

  it("post-Complete refund handoff uses Outstanding + Payments hrefs", () => {
    assert.equal(
      refundOutstandingHref("reg-9"),
      "/finance?tab=outstanding&registrationId=reg-9"
    );
    assert.equal(
      refundPaymentsHref("reg-9"),
      "/finance?tab=payments&registrationId=reg-9"
    );
    const panel = readFileSync(
      resolve(WEB_ROOT, "src/finance/finance-refunds-panel.tsx"),
      "utf8"
    );
    assert.match(panel, /viewOutstanding/);
    assert.match(panel, /openPaymentsForRegistration/);
    assert.match(panel, /amountHero/);
    assert.match(panel, /completeHandoff/);
  });

  it("EN/FA copy: soft aging, localized moneyGate, Help summary", () => {
    const en = JSON.parse(
      readFileSync(resolve(WEB_ROOT, "messages/en/finance.json"), "utf8")
    ) as {
      commandCenter: Record<string, string>;
      overview: Record<string, string>;
      outstanding: Record<string, string>;
      refunds: Record<string, string>;
      exceptions: Record<string, string>;
    };
    const fa = JSON.parse(
      readFileSync(resolve(WEB_ROOT, "messages/fa/finance.json"), "utf8")
    ) as {
      commandCenter: Record<string, string>;
      overview: Record<string, string>;
      outstanding: Record<string, string>;
      refunds: Record<string, string>;
      exceptions: Record<string, string>;
    };

    assert.ok(en.commandCenter.operatorHelpSummary);
    assert.ok(fa.commandCenter.operatorHelpSummary);
    assert.doesNotMatch(en.outstanding.agingUnavailable, /not shipped/i);
    assert.doesNotMatch(fa.outstanding.agingUnavailable, /ارسال نشده/);
    assert.doesNotMatch(fa.refunds.moneyGateHint, /Requested|Approved|Complete/);
    assert.match(fa.refunds.moneyGateHint, /تکمیل/);
    assert.ok(en.exceptions.openOutstanding);
    assert.ok(fa.exceptions.openOutstanding);
    assert.ok(en.overview.refundsAwaitingEmpty);
    assert.ok(fa.overview.collectionQueuesTitle);
    assert.ok(en.refunds.viewOutstanding);
    assert.ok(fa.refunds.amountAdjust);
  });

  it("safety: no aging endpoint / client AR sum / PSP in UX2 surfaces", () => {
    const overview = readFileSync(
      resolve(WEB_ROOT, "src/finance/finance-overview-panel.tsx"),
      "utf8"
    );
    const refunds = readFileSync(
      resolve(WEB_ROOT, "src/finance/finance-refunds-panel.tsx"),
      "utf8"
    );
    assert.doesNotMatch(overview, /outstanding-aging|ageDays|totalOutstanding/);
    assert.doesNotMatch(refunds, /psp|stripe|gateway|chargeback/i);
    assert.doesNotMatch(overview, /psp|stripe|gateway/i);
  });
});
