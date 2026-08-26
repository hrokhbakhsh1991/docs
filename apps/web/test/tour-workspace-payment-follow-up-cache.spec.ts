import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("tour-workspace-payment-follow-up-cache.spec.ts", () => {
  it("obligation override invalidates finance + tour workspace caches", () => {
    const source = readFileSync(
      resolve(WEB_ROOT, "src/features/tours/tour-workspace-payment-override-actions.tsx"),
      "utf8"
    );
    assert.match(source, /invalidateFinanceRegistrationCaches/);
    assert.match(source, /invalidateTourWorkspaceFinanceCache/);
  });

  it("bookings shell invalidates tour finance cache after approve-without-payment", () => {
    const shell = readFileSync(
      resolve(WEB_ROOT, "src/features/bookings/bookings-command-center-shell.tsx"),
      "utf8"
    );
    const buttons = readFileSync(
      resolve(WEB_ROOT, "src/features/bookings/booking-action-buttons.tsx"),
      "utf8"
    );
    assert.match(shell, /approveBookingWithoutPayment/);
    assert.match(shell, /invalidateTourWorkspaceFinanceCache\(lockedTour\)/);
    assert.match(shell, /runApproveWithoutPayment/);
    assert.match(buttons, /approveWithoutPaymentButton/);
  });

  it("finance detail uses progressive disclosure and roster-backed list", () => {
    const source = readFileSync(
      resolve(WEB_ROOT, "src/features/tours/tour-workspace-finance-client.tsx"),
      "utf8"
    );
    assert.match(source, /detailRecommendation/);
    assert.match(source, /<details className="rounded-md border border-dashed/);
    assert.match(source, /useTourWorkspacePaymentFollowUpList/);
    assert.doesNotMatch(source, /detailSummaryDescription/);
  });
});
