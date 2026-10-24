import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { BookingPaymentAdapter } from "../src/workspace-finance/infrastructure/booking-payment.adapter.ts";

describe("BookingPaymentAdapter cancelled registration guard", () => {
  it("does not mark a deadline-cancelled registration paid after the tour lock", async () => {
    const events: string[] = [];
    let lookupCount = 0;
    let updateCount = 0;
    const tx = {
      async $executeRaw() {
        events.push("tour-lock");
        return 1;
      },
      operatorRegistration: {
        async findFirst() {
          lookupCount += 1;
          events.push(`lookup-${lookupCount}`);
          if (lookupCount === 1) return { id: "registration-1", tourId: "tour-1" };
          return {
            id: "registration-1",
            status: "cancelled",
            paymentStatus: "unpaid",
            finalizationStatus: "not_final",
          };
        },
        async updateMany() {
          updateCount += 1;
          return { count: 1 };
        },
      },
    };
    const adapter = new BookingPaymentAdapter({} as never);

    await assert.rejects(
      adapter.raisePaidInTx(tx as never, {
        tenantId: "tenant-1",
        registrationId: "registration-1",
        paymentStatus: "paid",
      }),
      { message: "FINANCE_BOOKING_PAYMENT_SYNC_MISS" }
    );

    assert.deepEqual(events, ["lookup-1", "tour-lock", "lookup-2"]);
    assert.equal(updateCount, 0, "cancelled booking must not be changed to paid");
  });
});
