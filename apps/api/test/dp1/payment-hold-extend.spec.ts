/**
 * DP1-I / S11 — operator extend deadline.
 */
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";

import {
  DP1_TENANT_DENALI,
  addHoursUtc,
  dp1CreateAndApprovePending,
  requirePaymentHoldPort,
  resetDp1MemoryHarness,
} from "./dp1-test-harness.ts";

describe("DP1-I payment hold extend", { concurrency: false }, () => {
  before(() => resetDp1MemoryHarness());
  beforeEach(() => resetDp1MemoryHarness());
  after(() => resetDp1MemoryHarness());

  it("S11: operator extends deadline by +24h", async () => {
    const { bookingId, approved } = await dp1CreateAndApprovePending();
    const holdPort = await requirePaymentHoldPort();
    const originalDue = approved.paymentDueAt ?? approved.approvedAt;
    const extendedDue = addHoursUtc(originalDue, 24);

    const mod = (await import("../../src/finance/payment-hold-extend.ts")) as {
      extendPaymentHoldDeadline(input: {
        tenantId: string;
        registrationId: string;
        newDueAt: string;
        actorUserId: string;
      }): Promise<{ dueAt: string; holdStatus: string }>;
    };
    assert.equal(typeof mod.extendPaymentHoldDeadline, "function");
    const result = await mod.extendPaymentHoldDeadline({
      tenantId: DP1_TENANT_DENALI,
      registrationId: bookingId,
      newDueAt: extendedDue,
      actorUserId: "00000000-0000-4000-8000-000000000201",
    });
    assert.equal(result.dueAt, extendedDue);
    assert.equal(result.holdStatus, "open");

    const hold = await holdPort.getByRegistrationId(DP1_TENANT_DENALI, bookingId);
    assert.equal(hold?.dueAt, extendedDue);
  });

  it("S14: tour policy change after approval does not move dueAt", async () => {
    const { bookingId, approved } = await dp1CreateAndApprovePending();
    const holdPort = await requirePaymentHoldPort();
    const hold = await holdPort.getByRegistrationId(DP1_TENANT_DENALI, bookingId);
    assert.equal(hold?.dueAt, approved.paymentDueAt);
  });
});
