import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import ExcelJS from "exceljs";

import {
  approveBooking,
  createBooking,
  finalizeBookingWithOpenPayment,
} from "../bookings/create-bookings-service.ts";
import { createFinalRosterExport } from "./final-roster-export.ts";
import {
  replaceTransportAllocations,
  resetTransportAllocationStoreForTests,
} from "../transport/transport-allocation.repository.ts";
import {
  DP1_TOUR_ID,
  dp1BookingBody,
  dp1OpsAuth,
  resetDp1MemoryHarness,
} from "../../test/dp1/dp1-test-harness.ts";

describe("final roster export shared-car API flow", { concurrency: false }, () => {
  before(() => resetDp1MemoryHarness());
  after(() => {
    resetTransportAllocationStoreForTests();
    resetDp1MemoryHarness();
  });

  it("exports an approved driver and assigned dong passengers as parsed workbook rows", async () => {
    resetDp1MemoryHarness();
    resetTransportAllocationStoreForTests();
    const auth = dp1OpsAuth();
    const driver = await createBooking(
      auth,
      dp1BookingBody({
        guestLabel: "QA Shared Car Driver",
        partySize: 1,
        registrationIntake: {
          transport: { kind: "personal_car", personalCarOccupants: 3 },
        },
      })
    );
    const passengers = await Promise.all(
      ["QA Dong Passenger One", "QA Dong Passenger Two"].map((guestLabel) =>
        createBooking(
          auth,
          dp1BookingBody({
            guestLabel,
            partySize: 1,
            registrationIntake: { transport: { kind: "no_car_dong" } },
          })
        )
      )
    );

    await approveBooking(auth, driver.id);
    for (const passenger of passengers) {
      await approveBooking(auth, passenger.id);
    }
    await finalizeBookingWithOpenPayment(auth, driver.id);
    for (const passenger of passengers) {
      await finalizeBookingWithOpenPayment(auth, passenger.id);
    }

    const allocations = replaceTransportAllocations({
      tenantId: auth.tenantId,
      tourId: DP1_TOUR_ID,
      actorUserId: auth.userId,
      nowIso: new Date("2031-07-01T10:00:00.000Z").toISOString(),
      allocations: passengers.map((passenger) => ({
        driverRegistrationId: driver.id,
        passengerRegistrationId: passenger.id,
      })),
    });
    assert.equal(allocations.length, 2);
    assert.ok(allocations.every((allocation) => allocation.driverRegistrationId === driver.id));

    const exported = await createFinalRosterExport(auth, DP1_TOUR_ID, "QA Shared Car Tour", 10);
    assert.equal(
      exported.contentType,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(exported.body);
    const finalRoster = workbook.getWorksheet("لیست نهایی");
    assert.ok(finalRoster);

    const exportedRows = new Map<string, { transport: string; capacity: string }>();
    for (let rowIndex = 2; rowIndex <= finalRoster.rowCount; rowIndex += 1) {
      const name = finalRoster.getCell(rowIndex, 2).text;
      if (name.startsWith("QA Shared Car") || name.startsWith("QA Dong Passenger")) {
        exportedRows.set(name, {
          transport: finalRoster.getCell(rowIndex, 11).text,
          capacity: finalRoster.getCell(rowIndex, 12).text,
        });
      }
    }

    assert.deepEqual([...exportedRows.keys()].sort(), [
      "QA Dong Passenger One",
      "QA Dong Passenger Two",
      "QA Shared Car Driver",
    ]);
    assert.deepEqual(exportedRows.get("QA Shared Car Driver"), {
      transport: "ماشین شخصی خودش",
      capacity: "۳ نفر",
    });
    for (const passengerName of ["QA Dong Passenger One", "QA Dong Passenger Two"]) {
      assert.deepEqual(exportedRows.get(passengerName), {
        transport: "ماشین شخصی دیگران — با هزینه دونگ",
        capacity: "—",
      });
    }
  });
});
