/**
 * List projection intake scalars — WAIVED display without full registrationIntake blob.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { BookingRecord } from "./bookings.types";
import { InMemoryBookingsRepository } from "./in-memory-bookings.repository";
import {
  enrichInMemoryBookingListRecord,
  resolveFinancialDisplayStateForListRecord,
} from "./booking-list-intake-scalars";

const USER_ID = "00000000-0000-4000-8000-000000000b01";

function baseRecord(
  overrides: Partial<BookingRecord> & Pick<BookingRecord, "id" | "paymentStatus" | "status">
): BookingRecord {
  return {
    id: overrides.id,
    tenantId: "00000000-0000-4000-8000-000000000801",
    tourId: "00000000-0000-4000-8000-000000000a01",
    tourTitle: "Scalar Tour",
    guestLabel: "Guest",
    guestEmail: null,
    guestPhone: null,
    partySize: 1,
    status: overrides.status,
    paymentStatus: overrides.paymentStatus,
    departureAt: "2026-08-15T00:00:00.000Z",
    submittedAt: "2026-07-07T12:00:00.000Z",
    submittedByUserId: USER_ID,
    approvedAt: overrides.status === "approved" ? "2026-07-08T12:00:00.000Z" : null,
    registrationIntake: overrides.registrationIntake,
    ...overrides,
  };
}

const ZERO_OBLIGATION_OVERRIDE = {
  obligationMinor: "0",
  setAt: "2026-07-08T12:00:00.000Z",
  setByUserId: USER_ID,
} as const;

describe("booking-list-intake-scalars.spec.ts", () => {
  it("BKG-LIST-01 unpaid row projects without financialDisplayState", () => {
    const record = enrichInMemoryBookingListRecord(
      baseRecord({
        id: "00000000-0000-4000-8000-000000000901",
        status: "pending",
        paymentStatus: "unpaid",
      })
    );
    assert.equal(record.registrationIntake, undefined);
    assert.equal(record.financialDisplayState, undefined);
  });

  it("BKG-LIST-02 partial row projects without financialDisplayState", () => {
    const record = enrichInMemoryBookingListRecord(
      baseRecord({
        id: "00000000-0000-4000-8000-000000000902",
        status: "approved",
        paymentStatus: "partial",
      })
    );
    assert.equal(record.registrationIntake, undefined);
    assert.equal(record.financialDisplayState, undefined);
  });

  it("BKG-LIST-03 paid cash row without zero obligation omits WAIVED", () => {
    const record = enrichInMemoryBookingListRecord(
      baseRecord({
        id: "00000000-0000-4000-8000-000000000903",
        status: "approved",
        paymentStatus: "paid",
        registrationIntake: { tourCapacityMax: 12 },
      })
    );
    assert.equal(record.registrationIntake, undefined);
    assert.equal(record.financialDisplayState, undefined);
  });

  it("BKG-LIST-04 waived row keeps financialDisplayState=WAIVED from obligationOverride", () => {
    const record = enrichInMemoryBookingListRecord(
      baseRecord({
        id: "00000000-0000-4000-8000-000000000904",
        status: "approved",
        paymentStatus: "paid",
        registrationIntake: {
          registrantTarget: "other",
          transport: { kind: "primary" },
          obligationOverride: ZERO_OBLIGATION_OVERRIDE,
        },
      })
    );
    assert.equal(record.registrationIntake, undefined);
    assert.equal(record.financialDisplayState, "WAIVED");
    assert.equal(record.registrantTarget, "other");
    assert.equal(record.transportKind, "primary");
  });

  it("BKG-LIST-05 resolveFinancialDisplayState does not infer WAIVED from paid alone", () => {
    assert.equal(
      resolveFinancialDisplayStateForListRecord(
        { status: "approved", paymentStatus: "paid" },
        null
      ),
      undefined
    );
  });

  it("BKG-LIST-06 resolveFinancialDisplayState does not infer WAIVED from zero obligation when unpaid", () => {
    assert.equal(
      resolveFinancialDisplayStateForListRecord(
        { status: "pending", paymentStatus: "unpaid" },
        ZERO_OBLIGATION_OVERRIDE
      ),
      undefined
    );
  });

  it("BKG-LIST-07 free collection marker projects WAIVED without an override", () => {
    const record = enrichInMemoryBookingListRecord(
      baseRecord({
        id: "00000000-0000-0000-0000-000000000907",
        status: "approved",
        paymentStatus: "paid",
        registrationIntake: { freeCollectionApplied: true },
      })
    );
    assert.equal(record.registrationIntake, undefined);
    assert.equal(record.financialDisplayState, "WAIVED");
  });

  it("BUG-STG-080 projects approved free rows as WAIVED before payment status", () => {
    assert.equal(
      resolveFinancialDisplayStateForListRecord(
        { status: "approved", paymentStatus: "unpaid" },
        null,
        true
      ),
      "WAIVED"
    );
  });

  it("does not preserve a stale WAIVED projection for an unpaid approved row", () => {
    const record = {
      status: "approved",
      paymentStatus: "unpaid",
      financialDisplayState: "WAIVED",
    } as const;

    assert.equal(resolveFinancialDisplayStateForListRecord(record, null, false), undefined);
  });

  it("BUG-STG-080 atomically marks free collection paid, finalized, and waived", async () => {
    const repo = new InMemoryBookingsRepository();
    const record = baseRecord({
      id: "00000000-0000-0000-0000-000000000908",
      status: "approved",
      paymentStatus: "unpaid",
    });
    repo.seedBooking(record);

    const updated = await repo.markFreeCollectionApplied({
      bookingId: record.id,
      tenantId: record.tenantId,
    });

    assert.equal(updated?.paymentStatus, "paid");
    assert.equal(updated?.finalizationStatus, "finalized");
    assert.equal(updated?.registrationIntake?.freeCollectionApplied, true);
    assert.equal(enrichInMemoryBookingListRecord(updated!).financialDisplayState, "WAIVED");
  });

  it("BUG-STG-080 free collection marking is idempotent under retry", async () => {
    const repo = new InMemoryBookingsRepository();
    const record = baseRecord({
      id: "00000000-0000-0000-0000-000000000909",
      status: "approved",
      paymentStatus: "unpaid",
    });
    repo.seedBooking(record);

    const results = await Promise.all([
      repo.markFreeCollectionApplied({ bookingId: record.id, tenantId: record.tenantId }),
      repo.markFreeCollectionApplied({ bookingId: record.id, tenantId: record.tenantId }),
    ]);
    const finalRow = await repo.getById(record.id, record.tenantId);

    assert.equal(results.every((result) => result?.paymentStatus === "paid"), true);
    assert.equal(finalRow?.finalizationStatus, "finalized");
    assert.equal(finalRow?.registrationIntake?.freeCollectionApplied, true);
  });
});
