import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { TOUR_WORKSPACE_PAYMENT_FOLLOW_UP_ROW_TEST_IDS } from "../src/features/tours/tour-workspace-payment-follow-up-row";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const rowSource = readFileSync(
  resolve(WEB_ROOT, "src/features/tours/tour-workspace-payment-follow-up-row.tsx"),
  "utf8"
);
const financeSource = readFileSync(
  resolve(WEB_ROOT, "src/features/tours/tour-workspace-finance-client.tsx"),
  "utf8"
);
const faBookings = readFileSync(resolve(WEB_ROOT, "messages/fa/bookings.json"), "utf8");

describe("tour-workspace-payment-follow-up-row.spec.ts", () => {
  it("exposes compact row test ids for amount due and payment badge", () => {
    assert.equal(
      TOUR_WORKSPACE_PAYMENT_FOLLOW_UP_ROW_TEST_IDS.row,
      "operator-tour-workspace-payment-follow-up-row"
    );
    assert.equal(
      TOUR_WORKSPACE_PAYMENT_FOLLOW_UP_ROW_TEST_IDS.paymentBadge,
      "operator-tour-workspace-payment-follow-up-payment-badge"
    );
    assert.equal(
      TOUR_WORKSPACE_PAYMENT_FOLLOW_UP_ROW_TEST_IDS.amountDue,
      "operator-tour-workspace-payment-follow-up-amount-due"
    );
    assert.equal(
      TOUR_WORKSPACE_PAYMENT_FOLLOW_UP_ROW_TEST_IDS.deadline,
      "operator-tour-workspace-payment-follow-up-deadline"
    );
    assert.equal(
      TOUR_WORKSPACE_PAYMENT_FOLLOW_UP_ROW_TEST_IDS.primaryAction,
      "operator-tour-workspace-payment-follow-up-primary-action"
    );
  });

  it("renders avatar, badges, deadline, and inline primary action", () => {
    assert.match(rowSource, /OperatorProfileAvatar/);
    assert.match(rowSource, /fallbackMode="icon"/);
    assert.doesNotMatch(rowSource, /rowInitials/);
    assert.match(rowSource, /registrationBadge/);
    assert.match(rowSource, /paymentBadge/);
    assert.match(rowSource, /rowDeadline/);
    assert.match(rowSource, /primaryAction/);
    assert.match(rowSource, /formatMinorAmount/);
  });

  it("finance guest list uses roster-backed follow-up hook and row actions", () => {
    assert.match(financeSource, /useTourWorkspacePaymentFollowUpList/);
    assert.match(financeSource, /runFollowUpRowAction/);
    assert.match(financeSource, /onPrimaryAction/);
  });
});

describe("payment follow-up operator labels — fa", () => {
  it("uses explicit Persian approve/reject/waiver wording", () => {
    const messages = JSON.parse(faBookings) as Record<string, string>;
    assert.equal(messages.rejectRegistration, "رد ثبت‌نام");
    assert.equal(messages.approveAwaitingPayment, "تأیید و منتظر پرداخت");
    assert.equal(messages.approveWithoutPayment, "تأیید بدون نیاز به پرداخت");
    assert.match(messages.approveWithoutPaymentSuccess ?? "", /نیازی به پرداخت/);
    assert.doesNotMatch(messages.approveWithoutPayment ?? "", /دریافت|نقد/);
  });
});
