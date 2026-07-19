/**
 * In-memory single-credit gate for approve (mirrors Prisma Path B check).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isTourCreatedLedgerDomainEventId,
  tourCreatedLedgerDomainEventPrefix,
} from "./registration-booking-wallet-credit";
import { paymentLedgerCaptureDomainEventId } from "./paid-without-ledger-detection";

/** Pure probe used by regression tests — same predicates as durable SQL helpers. */
export function registrationWalletCreditsFromOutbox(input: {
  readonly registrationId: string;
  readonly paymentIds: readonly string[];
  readonly outboxDomainEventIds: readonly string[];
}): { readonly pathA: boolean; readonly pathB: boolean } {
  const pathB = input.outboxDomainEventIds.some((id) =>
    isTourCreatedLedgerDomainEventId(id, input.registrationId)
  );
  const captureIds = new Set(
    input.paymentIds.map((id) => paymentLedgerCaptureDomainEventId(id))
  );
  const pathA = input.outboxDomainEventIds.some((id) => captureIds.has(id));
  return { pathA, pathB };
}

describe("DUP pure single-credit probe", () => {
  it("DUP-01 A then B — pathA blocks pathB", () => {
    const registrationId = "reg-1";
    const paymentId = "pay-1";
    const afterA = registrationWalletCreditsFromOutbox({
      registrationId,
      paymentIds: [paymentId],
      outboxDomainEventIds: [paymentLedgerCaptureDomainEventId(paymentId)],
    });
    assert.equal(afterA.pathA, true);
    assert.equal(afterA.pathB, false);
    assert.equal(
      afterA.pathA || afterA.pathB,
      true,
      "Path B must skip when Path A present"
    );
  });

  it("DUP-02 B then A — pathB blocks pathA", () => {
    const registrationId = "reg-2";
    const paymentId = "pay-2";
    const tourEvt = `${tourCreatedLedgerDomainEventPrefix(registrationId)}tour-evt-1`;
    const afterB = registrationWalletCreditsFromOutbox({
      registrationId,
      paymentIds: [paymentId],
      outboxDomainEventIds: [tourEvt],
    });
    assert.equal(afterB.pathB, true);
    assert.equal(afterB.pathA, false);
    assert.equal(
      afterB.pathA || afterB.pathB,
      true,
      "Path A must fail closed when Path B present"
    );
  });

  it("neither path — both may proceed (first writer wins under lock)", () => {
    const credits = registrationWalletCreditsFromOutbox({
      registrationId: "reg-3",
      paymentIds: ["pay-3"],
      outboxDomainEventIds: [],
    });
    assert.equal(credits.pathA || credits.pathB, false);
  });
});
