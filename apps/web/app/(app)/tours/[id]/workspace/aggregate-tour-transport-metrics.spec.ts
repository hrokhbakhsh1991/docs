import assert from "node:assert/strict";
import test from "node:test";

import type { BookingDto } from "@repo/types";

import { aggregateTourTransportMetrics } from "./aggregate-tour-transport-metrics";

function reg(partial: Partial<BookingDto> & Pick<BookingDto, "transportMode" | "status">): BookingDto {
  return {
    id: "r1",
    tenantId: "t1",
    tourId: "tour1",
    participantFullName: "Test",
    participantContactPhone: "+1",
    entryMode: "web",
    rowVersion: 1,
    paymentStatus: "NotPaid",
    createdAt: "",
    updatedAt: "",
    ...partial,
  };
}

test("aggregateTourTransportMetrics counts bus and car roles for accepted rows only", () => {
  const metrics = aggregateTourTransportMetrics(
    [
      reg({ transportMode: "group_vehicle", status: "Accepted" }),
      reg({ transportMode: "group_vehicle", status: "Pending" }),
      reg({
        transportMode: "self_vehicle",
        status: "AcceptedPaid",
        vehicleSeatCapacity: 2,
        participantMetadata: { transportIntake: { isDriver: true } },
      }),
      reg({
        transportMode: "self_vehicle",
        status: "Accepted",
        participantMetadata: { transportIntake: { isDriver: false } },
      }),
      reg({
        transportMode: "self_vehicle",
        status: "Accepted",
        participantMetadata: { transportIntake: { isDriver: false } },
      }),
    ],
    10,
  );

  assert.equal(metrics.busHeadcount, 1);
  assert.equal(metrics.totalCarDrivers, 1);
  assert.equal(metrics.totalCarAvailableSeats, 2);
  assert.equal(metrics.totalCarPassengers, 2);
  assert.equal(metrics.carCapacityBalance, 0);
  assert.equal(metrics.busLoadRatio, 0.1);
});

test("aggregateTourTransportMetrics: negative carCapacityBalance", () => {
  const metrics = aggregateTourTransportMetrics(
    [
      reg({
        transportMode: "self_vehicle",
        status: "Accepted",
        vehicleSeatCapacity: 1,
        participantMetadata: { transportIntake: { isDriver: true } },
      }),
      reg({
        transportMode: "self_vehicle",
        status: "Accepted",
        participantMetadata: { transportIntake: { isDriver: false } },
      }),
      reg({
        transportMode: "self_vehicle",
        status: "Accepted",
        participantMetadata: { transportIntake: { isDriver: false } },
      }),
    ],
    20,
  );

  assert.equal(metrics.carCapacityBalance, -1);
});
