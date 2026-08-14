/**
 * Owned other→self reclassify — repository gate + merge (portal self POST path).
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { beforeEach, describe, it } from "node:test";

import { resetBookingsRepositoryForTests } from "./create-bookings-repository";
import { readRegistrantTargetFromIntake } from "./read-registrant-target";

const TENANT = "00000000-0000-4000-8000-000000000099";
const USER = "00000000-0000-4000-8000-000000000001";
const OTHER_USER = "00000000-0000-4000-8000-000000000002";

describe("reclassifyOwnedOtherToSelf", () => {
  beforeEach(() => {
    resetBookingsRepositoryForTests();
  });

  it("BK-RECLASS-01 — reclassifies owned active other row and sets registrantTarget=self", async () => {
    const repo = resetBookingsRepositoryForTests();
    const bookingId = randomUUID();
    repo.seedBooking({
      id: bookingId,
      tenantId: TENANT,
      tourId: "tour-a",
      tourTitle: "Tour A",
      guestLabel: "Guest Other",
      guestEmail: null,
      guestPhone: "+989121234567",
      partySize: 1,
      status: "pending",
      paymentStatus: "unpaid",
      departureAt: "2026-09-01T00:00:00.000Z",
      submittedAt: "2026-08-01T00:00:00.000Z",
      submittedByUserId: USER,
      approvedAt: null,
      registrationIntake: {
        registrantTarget: "other",
        nationalId: "1234567890",
      },
    });

    const result = await repo.reclassifyOwnedOtherToSelf({
      bookingId,
      tenantId: TENANT,
      submittedByUserId: USER,
      guestLabel: "Self Name",
      guestPhone: "+989121234567",
      intakePatch: {
        registrantTarget: "self",
        transport: { kind: "bus" },
      },
    });

    assert.notEqual(result, null);
    assert.equal(result?.id, bookingId);
    assert.equal(result?.status, "pending");

    const row = await repo.getById(bookingId, TENANT);
    assert.notEqual(row, null);
    assert.equal(row?.guestLabel, "Self Name");
    assert.equal(readRegistrantTargetFromIntake(row?.registrationIntake), "self");
    assert.equal(
      (row?.registrationIntake as { transport?: { kind?: string } })?.transport?.kind,
      "bus"
    );
  });

  it("BK-RECLASS-02 — wrong submitter returns null", async () => {
    const repo = resetBookingsRepositoryForTests();
    const bookingId = randomUUID();
    repo.seedBooking({
      id: bookingId,
      tenantId: TENANT,
      tourId: "tour-a",
      tourTitle: "Tour A",
      guestLabel: "Guest Other",
      partySize: 1,
      status: "pending",
      paymentStatus: "unpaid",
      departureAt: "2026-09-01T00:00:00.000Z",
      submittedAt: "2026-08-01T00:00:00.000Z",
      submittedByUserId: USER,
      approvedAt: null,
      registrationIntake: { registrantTarget: "other" },
    });

    const result = await repo.reclassifyOwnedOtherToSelf({
      bookingId,
      tenantId: TENANT,
      submittedByUserId: OTHER_USER,
      guestLabel: "Self Name",
      intakePatch: { registrantTarget: "self" },
    });
    assert.equal(result, null);
  });

  it("BK-RECLASS-03 — cancelled / self target / missing row return null", async () => {
    const repo = resetBookingsRepositoryForTests();
    const cancelledId = randomUUID();
    const selfId = randomUUID();
    repo.seedBooking({
      id: cancelledId,
      tenantId: TENANT,
      tourId: "tour-a",
      tourTitle: "Tour A",
      guestLabel: "Guest",
      partySize: 1,
      status: "cancelled",
      paymentStatus: "unpaid",
      departureAt: "2026-09-01T00:00:00.000Z",
      submittedAt: "2026-08-01T00:00:00.000Z",
      submittedByUserId: USER,
      approvedAt: null,
      registrationIntake: { registrantTarget: "other" },
    });
    repo.seedBooking({
      id: selfId,
      tenantId: TENANT,
      tourId: "tour-a",
      tourTitle: "Tour A",
      guestLabel: "Guest",
      partySize: 1,
      status: "pending",
      paymentStatus: "unpaid",
      departureAt: "2026-09-01T00:00:00.000Z",
      submittedAt: "2026-08-01T00:00:00.000Z",
      submittedByUserId: USER,
      approvedAt: null,
      registrationIntake: { registrantTarget: "self" },
    });

    assert.equal(
      await repo.reclassifyOwnedOtherToSelf({
        bookingId: cancelledId,
        tenantId: TENANT,
        submittedByUserId: USER,
        guestLabel: "X",
        intakePatch: { registrantTarget: "self" },
      }),
      null
    );
    assert.equal(
      await repo.reclassifyOwnedOtherToSelf({
        bookingId: selfId,
        tenantId: TENANT,
        submittedByUserId: USER,
        guestLabel: "X",
        intakePatch: { registrantTarget: "self" },
      }),
      null
    );
    assert.equal(
      await repo.reclassifyOwnedOtherToSelf({
        bookingId: randomUUID(),
        tenantId: TENANT,
        submittedByUserId: USER,
        guestLabel: "X",
        intakePatch: { registrantTarget: "self" },
      }),
      null
    );
  });

  it("BK-RECLASS-04 — host adapter delegates to repository (no getById pre-read)", () => {
    const src = readFileSync(
      new URL("./infrastructure/host-booking-public.adapter.ts", import.meta.url),
      "utf8"
    );
    const start = src.indexOf("async reclassifyOwnedOtherToSelf");
    assert.ok(start > 0);
    const end = src.indexOf("async ", start + 1);
    const body = src.slice(start, end > start ? end : undefined);
    assert.match(body, /\.reclassifyOwnedOtherToSelf\(/);
    assert.doesNotMatch(body, /getById/);
  });
});
