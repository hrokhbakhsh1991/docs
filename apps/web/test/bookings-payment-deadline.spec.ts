/**
 * DP1-I — operator web contract for payment deadline surfaces.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("DP1-I operator payment deadline contract", () => {
  it("S1 BR-OP-01: bookings command center row shows actionable paymentDueAt", () => {
    const row = readFileSync(join(webRoot, "src/features/bookings/booking-inbox-row.tsx"), "utf8");
    const types = readFileSync(
      join(webRoot, "src/features/bookings/bookings-command-center-types.ts"),
      "utf8"
    );
    assert.match(
      row,
      /paymentDueAt/,
      "DP1-EXPECTED-FAIL: operator bookings row must render actionable paymentDueAt"
    );
    assert.match(row, /data-operator-booking-payment-due-at/);
    assert.match(row, /resolveBookingActionablePaymentDueAt/);
    assert.match(row, /formatBookingDeparture/);
    assert.match(types, /paymentDueAt\?:/);
  });

  it("S4 BR-OP-03: cancelled payment deadline shows cancelSource", () => {
    const shell = readFileSync(
      join(webRoot, "src/features/bookings/bookings-command-center-shell.tsx"),
      "utf8"
    );
    assert.match(
      shell,
      /cancelSource|payment_deadline/,
      "DP1-EXPECTED-FAIL: operator UI must show payment deadline cancel reason"
    );
    assert.match(shell, /data-operator-booking-cancel-source/);
  });

  it("S11 BR-OP-04: extend deadline action wired to finance hold API", () => {
    const actions = readFileSync(
      join(webRoot, "src/features/bookings/booking-payment-deadline-actions.ts"),
      "utf8"
    );
    assert.match(actions, /payment-holds/);
    assert.match(actions, /extend/);
    assert.match(actions, /data-operator-extend-payment-deadline/);
  });

  it("S17: operator list item uses same paymentDueAt field as booking API", () => {
    const logic = readFileSync(
      join(webRoot, "src/features/bookings/bookings-command-center-logic.ts"),
      "utf8"
    );
    assert.match(logic, /paymentDueAt/);
    assert.doesNotMatch(logic, /approvedAt.*24.*60.*60/);
  });
});
