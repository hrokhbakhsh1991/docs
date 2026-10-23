/**
 * DP1-G — waitlist auto-promote on expiry (S6).
 */
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";

import {
  autoApprovePublicBooking,
  approveBooking,
  cancelBooking,
  createBooking,
  waitlistBooking,
} from "../../src/bookings/create-bookings-service.ts";
import { getBookingsRepository } from "../../src/bookings/create-bookings-repository.ts";
import { getPaymentHoldRepository } from "../../src/finance/payment-hold.repository.ts";
import { peekOutboxByAggregateForTests } from "../../src/bookings/in-memory-bookings.repository.ts";
import { createHostBookingPublicAdapter } from "../../src/bookings/infrastructure/host-booking-public.adapter.ts";
import { putTransportAllocations } from "../../src/settlement/driver-settlement.service.ts";
import { listTransportAllocations } from "../../src/transport/transport-allocation.repository.ts";
import {
  DP1_TENANT_DENALI,
  DP1_TOUR_ID,
  dp1BookingBody,
  dp1GetBooking,
  dp1OpsAuth,
  requirePaymentHoldPort,
  resetDp1MemoryHarness,
} from "./dp1-test-harness.ts";

describe("DP1-G payment deadline waitlist", { concurrency: false }, () => {
  before(() => resetDp1MemoryHarness());
  beforeEach(() => resetDp1MemoryHarness());
  after(() => resetDp1MemoryHarness());

  it("S6: expiry promotes one waitlisted guest with new hold + quote", async () => {
    const guestA = await createBooking(
      dp1OpsAuth(),
      dp1BookingBody({ guestLabel: "DP1 Guest A", partySize: 2, tourCapacityMax: 2 })
    );
    const guestB = await createBooking(
      dp1OpsAuth(),
      dp1BookingBody({ guestLabel: "DP1 Guest B", partySize: 2, tourCapacityMax: 2 })
    );
    await approveBooking(dp1OpsAuth(), guestA.id);
    await waitlistBooking(dp1OpsAuth(), guestB.id);

    const holdPort = await requirePaymentHoldPort();
    await holdPort.extend(DP1_TENANT_DENALI, guestA.id, "2030-01-01T00:00:00.000Z");
    const expiry = await import("../../src/finance/payment-hold-expiry.ts");
    await expiry.expirePaymentHoldForRegistration({
      tenantId: DP1_TENANT_DENALI,
      registrationId: guestA.id,
    });

    const promoted = await dp1GetBooking(guestB.id);
    assert.equal(promoted.status, "approved");
    assert.equal(promoted.paymentStatus, "unpaid");

    const promotedHold = await holdPort.getByRegistrationId(DP1_TENANT_DENALI, guestB.id);
    assert.ok(promotedHold !== null);
    assert.equal(promotedHold.status, "open");

    const quotePort = (await import("../../src/finance/commercial-quote-approve.service.ts")) as {
      createCommercialQuoteApproveServiceForTests: () => {
        getActiveQuote(
          tenantId: string,
          registrationId: string
        ): Promise<{
          status: string;
        } | null>;
      };
    };
    const quote = await quotePort
      .createCommercialQuoteApproveServiceForTests()
      .getActiveQuote(DP1_TENANT_DENALI, guestB.id);
    assert.equal(quote?.status, "FROZEN");
  });

  it("cancellation releases capacity without automatically admitting a fitting waitlisted guest", async () => {
    const blockingGuest = await createBooking(
      dp1OpsAuth(),
      dp1BookingBody({ guestLabel: "DP1 Cancellation Blocker", partySize: 1, tourCapacityMax: 1 })
    );
    const waitlistedGuest = await createBooking(
      dp1OpsAuth(),
      dp1BookingBody({ guestLabel: "DP1 Cancellation Waitlist", partySize: 1, tourCapacityMax: 1 })
    );
    await approveBooking(dp1OpsAuth(), blockingGuest.id);
    await waitlistBooking(dp1OpsAuth(), waitlistedGuest.id);

    await cancelBooking(dp1OpsAuth(), blockingGuest.id);

    const candidate = await dp1GetBooking(waitlistedGuest.id);
    assert.equal(candidate.status, "waitlisted");
    const holdPort = await requirePaymentHoldPort();
    assert.equal(await holdPort.getByRegistrationId(DP1_TENANT_DENALI, waitlistedGuest.id), null);
  });

  it("rechecks FIFO waitlist after capacity opens before the waitlist row is committed", async () => {
    const blocker = await createBooking(
      dp1OpsAuth(),
      dp1BookingBody({ guestLabel: "DP1 Race Capacity Blocker", partySize: 1, tourCapacityMax: 1 })
    );
    await approveBooking(dp1OpsAuth(), blocker.id);

    // Reproduce the interleaving: the initial public create fails capacity,
    // then a seat is released before the fallback waitlist write starts.
    await getBookingsRepository().cancelBooking({
      bookingId: blocker.id,
      tenantId: DP1_TENANT_DENALI,
      outboxEvent: "registration.cancelled",
    });

    const guestUserId = "00000000-0000-4000-8000-000000000777";
    const created = await createHostBookingPublicAdapter().createWaitlistedBooking!({
      tenantId: DP1_TENANT_DENALI,
      guestUserId,
      tourId: DP1_TOUR_ID,
      tourTitle: "DP1 Payment Deadline Tour",
      guestLabel: "DP1 Race Waitlist Guest",
      guestEmail: "dp1-race-waitlist@example.com",
      partySize: 1,
      departureAt: "2031-08-01T10:00:00.000Z",
      registrationIntake: { tourCapacityMax: 1 },
      outboxEvent: { eventType: "registration.waitlisted", payload: {} },
    });

    assert.equal(created.status, "approved");
    assert.equal((await dp1GetBooking(created.id)).status, "approved");
    const hold = await requirePaymentHoldPort().then((port) =>
      port.getByRegistrationId(DP1_TENANT_DENALI, created.id)
    );
    assert.ok(hold !== null, "promotion applies the normal payment-hold side effect");
    assert.equal(hold.status, "open");
    const events = peekOutboxByAggregateForTests({
      tenantId: DP1_TENANT_DENALI,
      aggregateId: created.id,
    });
    assert.ok(events.some((event) => event.eventType === "registration.waitlisted"));
    assert.ok(events.some((event) => event.eventType === "registration.approved"));
  });

  it("auto-waitlists a dong registration when approved drivers have no remaining seats", async () => {
    const driver = await createBooking(
      dp1OpsAuth(),
      dp1BookingBody({
        guestLabel: "DP1 Car Driver",
        partySize: 1,
        tourCapacityMax: 10,
        registrationIntake: {
          transport: { kind: "personal_car", personalCarOccupants: 1 },
        },
      })
    );
    await approveBooking(dp1OpsAuth(), driver.id);
    const approvedDriver = await dp1GetBooking(driver.id);
    assert.equal(
      (approvedDriver.registrationIntake?.transport as { kind?: string } | undefined)?.kind,
      "personal_car"
    );

    const firstDong = await createBooking(
      dp1OpsAuth(),
      dp1BookingBody({
        guestLabel: "DP1 First Dong Rider",
        partySize: 1,
        tourCapacityMax: 10,
        registrationIntake: { transport: { kind: "no_car_dong" } },
      })
    );
    const firstOwner = await dp1GetBooking(firstDong.id);
    const firstResult = await autoApprovePublicBooking({
      tenantId: DP1_TENANT_DENALI,
      bookingId: firstDong.id,
      actorUserId: firstOwner.submittedByUserId,
    });
    assert.equal(firstResult.status, "approved");

    const secondDong = await createBooking(
      dp1OpsAuth(),
      dp1BookingBody({
        guestLabel: "DP1 Second Dong Rider",
        partySize: 1,
        tourCapacityMax: 10,
        registrationIntake: { transport: { kind: "no_car_dong" } },
      })
    );
    const secondOwner = await dp1GetBooking(secondDong.id);
    const secondResult = await autoApprovePublicBooking({
      tenantId: DP1_TENANT_DENALI,
      bookingId: secondDong.id,
      actorUserId: secondOwner.submittedByUserId,
    });
    assert.equal(secondResult.status, "waitlisted");
    const holdPort = await requirePaymentHoldPort();
    assert.equal(await holdPort.getByRegistrationId(DP1_TENANT_DENALI, secondDong.id), null);
  });

  it("waitlists the sixth dong rider with one tour seat still available across four cars", async () => {
    for (const [index, seats] of [2, 1, 1, 1].entries()) {
      const driver = await createBooking(
        dp1OpsAuth(),
        dp1BookingBody({
          guestLabel: `DP1 Mixed Capacity Driver ${index + 1}`,
          partySize: 1,
          tourCapacityMax: 10,
          registrationIntake: {
            transport: { kind: "personal_car", personalCarOccupants: seats },
          },
        })
      );
      await approveBooking(dp1OpsAuth(), driver.id);
    }

    const dongRiders: string[] = [];
    for (let index = 0; index < 5; index += 1) {
      const rider = await createBooking(
        dp1OpsAuth(),
        dp1BookingBody({
          guestLabel: `DP1 Mixed Capacity Dong ${index + 1}`,
          partySize: 1,
          tourCapacityMax: 10,
          registrationIntake: { transport: { kind: "no_car_dong" } },
        })
      );
      dongRiders.push(rider.id);
      const owner = await dp1GetBooking(rider.id);
      const result = await autoApprovePublicBooking({
        tenantId: DP1_TENANT_DENALI,
        bookingId: rider.id,
        actorUserId: owner.submittedByUserId,
      });
      assert.equal(result.status, "approved", `dong rider ${index + 1} should fit`);
    }

    const sixthDong = await createBooking(
      dp1OpsAuth(),
      dp1BookingBody({
        guestLabel: "DP1 Mixed Capacity Dong 6",
        partySize: 1,
        tourCapacityMax: 10,
        registrationIntake: { transport: { kind: "no_car_dong" } },
      })
    );
    const sixthOwner = await dp1GetBooking(sixthDong.id);
    const sixthResult = await autoApprovePublicBooking({
      tenantId: DP1_TENANT_DENALI,
      bookingId: sixthDong.id,
      actorUserId: sixthOwner.submittedByUserId,
    });
    assert.equal(sixthResult.status, "waitlisted");
    assert.equal((await dp1GetBooking(sixthDong.id)).status, "waitlisted");
    assert.equal(
      await requirePaymentHoldPort().then((port) =>
        port.getByRegistrationId(DP1_TENANT_DENALI, sixthDong.id)
      ),
      null,
      "waitlisted dong rider must not receive a payment hold"
    );

    await cancelBooking(dp1OpsAuth(), dongRiders[0]!);
    assert.equal(
      (await dp1GetBooking(sixthDong.id)).status,
      "waitlisted",
      "releasing a car seat must not silently approve the waitlist"
    );
    const promoted = await approveBooking(dp1OpsAuth(), sixthDong.id);
    assert.equal(promoted.status, "approved");
    const promotedHold = await requirePaymentHoldPort().then((port) =>
      port.getByRegistrationId(DP1_TENANT_DENALI, sixthDong.id)
    );
    assert.ok(promotedHold !== null, "operator promotion applies a payment hold");
    assert.equal(promotedHold.status, "open");

    const selfArrival = await createBooking(
      dp1OpsAuth(),
      dp1BookingBody({
        guestLabel: "DP1 Mixed Capacity Self Arrival",
        partySize: 1,
        tourCapacityMax: 10,
        registrationIntake: { transport: { kind: "no_car_acquaintance" } },
      })
    );
    const selfArrivalOwner = await dp1GetBooking(selfArrival.id);
    const selfArrivalResult = await autoApprovePublicBooking({
      tenantId: DP1_TENANT_DENALI,
      bookingId: selfArrival.id,
      actorUserId: selfArrivalOwner.submittedByUserId,
    });
    assert.equal(
      selfArrivalResult.status,
      "approved",
      "self-arrival may use the remaining tour seat without consuming a car seat"
    );
  });

  it("releases a car seat on dong cancellation and admits waitlist only after operator approval", async () => {
    const driver = await createBooking(
      dp1OpsAuth(),
      dp1BookingBody({
        guestLabel: "DP1 Promotion Car Driver",
        partySize: 1,
        tourCapacityMax: 10,
        registrationIntake: {
          transport: { kind: "personal_car", personalCarOccupants: 1 },
        },
      })
    );
    await approveBooking(dp1OpsAuth(), driver.id);

    const firstDong = await createBooking(
      dp1OpsAuth(),
      dp1BookingBody({
        guestLabel: "DP1 Canceling Dong Rider",
        partySize: 1,
        tourCapacityMax: 10,
        registrationIntake: { transport: { kind: "no_car_dong" } },
      })
    );
    const firstOwner = await dp1GetBooking(firstDong.id);
    const firstResult = await autoApprovePublicBooking({
      tenantId: DP1_TENANT_DENALI,
      bookingId: firstDong.id,
      actorUserId: firstOwner.submittedByUserId,
    });
    assert.equal(firstResult.status, "approved");

    const waitlistedDong = await createBooking(
      dp1OpsAuth(),
      dp1BookingBody({
        guestLabel: "DP1 Promoted Dong Rider",
        partySize: 1,
        tourCapacityMax: 10,
        registrationIntake: { transport: { kind: "no_car_dong" } },
      })
    );
    const waitlistedOwner = await dp1GetBooking(waitlistedDong.id);
    const waitlistResult = await autoApprovePublicBooking({
      tenantId: DP1_TENANT_DENALI,
      bookingId: waitlistedDong.id,
      actorUserId: waitlistedOwner.submittedByUserId,
    });
    assert.equal(waitlistResult.status, "waitlisted");

    const holdPort = await requirePaymentHoldPort();
    assert.equal(await holdPort.getByRegistrationId(DP1_TENANT_DENALI, waitlistedDong.id), null);

    await cancelBooking(dp1OpsAuth(), firstDong.id);
    assert.equal((await dp1GetBooking(waitlistedDong.id)).status, "waitlisted");
    assert.equal(await holdPort.getByRegistrationId(DP1_TENANT_DENALI, waitlistedDong.id), null);

    const promoted = await approveBooking(dp1OpsAuth(), waitlistedDong.id);
    assert.equal(promoted.status, "approved");
    const promotedHold = await holdPort.getByRegistrationId(DP1_TENANT_DENALI, waitlistedDong.id);
    assert.ok(promotedHold !== null);
    assert.equal(promotedHold.status, "open");
  });

  it("serializes concurrent last-seat dong approvals without overselling car seats", async () => {
    const driver = await createBooking(
      dp1OpsAuth(),
      dp1BookingBody({
        guestLabel: "DP1 Concurrent Car Driver",
        partySize: 1,
        tourCapacityMax: 10,
        registrationIntake: {
          transport: { kind: "personal_car", personalCarOccupants: 1 },
        },
      })
    );
    await approveBooking(dp1OpsAuth(), driver.id);

    const candidates = await Promise.all(
      ["Concurrent Dong A", "Concurrent Dong B"].map((guestLabel) =>
        createBooking(
          dp1OpsAuth(),
          dp1BookingBody({
            guestLabel,
            partySize: 1,
            tourCapacityMax: 10,
            registrationIntake: { transport: { kind: "no_car_dong" } },
          })
        )
      )
    );
    const outcomes = await Promise.all(
      candidates.map(async (candidate) => {
        const owner = await dp1GetBooking(candidate.id);
        return autoApprovePublicBooking({
          tenantId: DP1_TENANT_DENALI,
          bookingId: candidate.id,
          actorUserId: owner.submittedByUserId,
        });
      })
    );

    assert.deepEqual(outcomes.map((result) => result.status).sort(), ["approved", "waitlisted"]);
    const approvedRiders = await Promise.all(candidates.map((row) => dp1GetBooking(row.id)));
    assert.equal(approvedRiders.filter((row) => row.status === "approved").length, 1);
    assert.equal(approvedRiders.filter((row) => row.status === "waitlisted").length, 1);
  });

  it("blocks canceling a driver when it would strand approved dong riders", async () => {
    const driver = await createBooking(
      dp1OpsAuth(),
      dp1BookingBody({
        guestLabel: "DP1 Protected Driver",
        partySize: 1,
        tourCapacityMax: 10,
        registrationIntake: {
          transport: { kind: "personal_car", personalCarOccupants: 1 },
        },
      })
    );
    await approveBooking(dp1OpsAuth(), driver.id);

    const rider = await createBooking(
      dp1OpsAuth(),
      dp1BookingBody({
        guestLabel: "DP1 Protected Dong Rider",
        partySize: 1,
        tourCapacityMax: 10,
        registrationIntake: { transport: { kind: "no_car_dong" } },
      })
    );
    const riderOwner = await dp1GetBooking(rider.id);
    await autoApprovePublicBooking({
      tenantId: DP1_TENANT_DENALI,
      bookingId: rider.id,
      actorUserId: riderOwner.submittedByUserId,
    });

    await assert.rejects(
      cancelBooking(dp1OpsAuth(), driver.id),
      /BOOKING_TRANSPORT_CAPACITY_REJECTED/
    );
    assert.equal((await dp1GetBooking(driver.id)).status, "approved");
    assert.equal((await dp1GetBooking(rider.id)).status, "approved");
    assert.equal(
      peekOutboxByAggregateForTests({ tenantId: DP1_TENANT_DENALI, aggregateId: driver.id }).some(
        (event) => event.eventType === "registration.cancelled"
      ),
      false,
      "rejected driver cancellation must not emit a cancellation event"
    );

    await cancelBooking(dp1OpsAuth(), rider.id);
    await cancelBooking(dp1OpsAuth(), driver.id);
    assert.equal((await dp1GetBooking(driver.id)).status, "cancelled");
  });

  it("does not let a stale registration amendment reduce seats after driver approval", async () => {
    const driver = await createBooking(
      dp1OpsAuth(),
      dp1BookingBody({
        guestLabel: "DP1 Immutable Approved Driver",
        partySize: 1,
        tourCapacityMax: 10,
        registrationIntake: {
          transport: { kind: "personal_car", personalCarOccupants: 2 },
        },
      })
    );
    await approveBooking(dp1OpsAuth(), driver.id);

    const rider = await createBooking(
      dp1OpsAuth(),
      dp1BookingBody({
        guestLabel: "DP1 Protected Approved Dong",
        partySize: 2,
        tourCapacityMax: 10,
        registrationIntake: { transport: { kind: "no_car_dong" } },
      })
    );
    const riderOwner = await dp1GetBooking(rider.id);
    const approvedRider = await autoApprovePublicBooking({
      tenantId: DP1_TENANT_DENALI,
      bookingId: rider.id,
      actorUserId: riderOwner.submittedByUserId,
    });
    assert.equal(approvedRider.status, "approved");

    const updated = await getBookingsRepository().mergeRegistrationIntake({
      bookingId: driver.id,
      tenantId: DP1_TENANT_DENALI,
      patch: { transport: { kind: "personal_car", personalCarOccupants: 0 } },
      allowedStatuses: ["pending", "waitlisted"],
    });
    assert.equal(updated, null);
    const unchanged = await dp1GetBooking(driver.id);
    assert.deepEqual(unchanged.registrationIntake?.transport, {
      kind: "personal_car",
      personalCarOccupants: 2,
    });
    assert.equal((await dp1GetBooking(rider.id)).status, "approved");
  });

  it("moves strictly unpaid assigned riders to waitlist before expiring a driver's hold", async () => {
    const driver = await createBooking(
      dp1OpsAuth(),
      dp1BookingBody({
        guestLabel: "DP1 Expiring Driver",
        partySize: 1,
        tourCapacityMax: 10,
        registrationIntake: {
          transport: { kind: "personal_car", personalCarOccupants: 1 },
        },
      })
    );
    await approveBooking(dp1OpsAuth(), driver.id);

    const rider = await createBooking(
      dp1OpsAuth(),
      dp1BookingBody({
        guestLabel: "DP1 Deadline-Protected Dong Rider",
        partySize: 1,
        tourCapacityMax: 10,
        registrationIntake: { transport: { kind: "no_car_dong" } },
      })
    );
    const riderOwner = await dp1GetBooking(rider.id);
    await autoApprovePublicBooking({
      tenantId: DP1_TENANT_DENALI,
      bookingId: rider.id,
      actorUserId: riderOwner.submittedByUserId,
    });
    await putTransportAllocations(dp1OpsAuth(), DP1_TOUR_ID, [
      { driverRegistrationId: driver.id, passengerRegistrationId: rider.id },
    ]);

    const holdPort = await requirePaymentHoldPort();
    await holdPort.extend(DP1_TENANT_DENALI, driver.id, "2030-01-01T00:00:00.000Z");
    const expiry = await import("../../src/finance/payment-hold-expiry.ts");

    await expiry.expirePaymentHoldForRegistration({
      tenantId: DP1_TENANT_DENALI,
      registrationId: driver.id,
    });

    assert.equal((await dp1GetBooking(driver.id)).status, "cancelled");
    assert.equal((await dp1GetBooking(rider.id)).status, "waitlisted");
    assert.equal(
      await getBookingsRepository().updatePaymentStatus({
        bookingId: driver.id,
        tenantId: DP1_TENANT_DENALI,
        paymentStatus: "paid",
      }),
      null,
      "a late payment sync must not change a deadline-cancelled driver"
    );
    assert.equal((await dp1GetBooking(driver.id)).paymentStatus, "unpaid");
    assert.equal(
      (await holdPort.getByRegistrationId(DP1_TENANT_DENALI, driver.id))?.status,
      "expired"
    );
    assert.equal(
      (await holdPort.getByRegistrationId(DP1_TENANT_DENALI, rider.id))?.status,
      "expired"
    );
    assert.equal(
      peekOutboxByAggregateForTests({ tenantId: DP1_TENANT_DENALI, aggregateId: rider.id }).some(
        (event) => event.eventType === "registration.waitlisted"
      ),
      true
    );
  });

  it("retries a partially completed driver-expiry workflow on the next scheduler tick", async () => {
    const driver = await createBooking(
      dp1OpsAuth(),
      dp1BookingBody({
        guestLabel: "DP1 Retry Driver",
        partySize: 1,
        tourCapacityMax: 10,
        registrationIntake: {
          transport: { kind: "personal_car", personalCarOccupants: 1 },
        },
      })
    );
    await approveBooking(dp1OpsAuth(), driver.id);

    const rider = await createBooking(
      dp1OpsAuth(),
      dp1BookingBody({
        guestLabel: "DP1 Retry Assigned Rider",
        partySize: 1,
        tourCapacityMax: 10,
        registrationIntake: { transport: { kind: "no_car_dong" } },
      })
    );
    const riderOwner = await dp1GetBooking(rider.id);
    await autoApprovePublicBooking({
      tenantId: DP1_TENANT_DENALI,
      bookingId: rider.id,
      actorUserId: riderOwner.submittedByUserId,
    });
    await putTransportAllocations(dp1OpsAuth(), DP1_TOUR_ID, [
      { driverRegistrationId: driver.id, passengerRegistrationId: rider.id },
    ]);

    const holdPort = await requirePaymentHoldPort();
    await holdPort.extend(DP1_TENANT_DENALI, driver.id, "2030-01-01T00:00:00.000Z");
    await holdPort.extend(DP1_TENANT_DENALI, rider.id, "2031-01-01T00:00:00.000Z");
    const repo = getBookingsRepository();
    const expireDriverHoldImpl = repo.expireDriverHoldWithUnpaidPassengers.bind(repo);
    let failOnce = true;
    repo.expireDriverHoldWithUnpaidPassengers = async (input) => {
      if (input.driverBookingId === driver.id && failOnce) {
        failOnce = false;
        throw Object.assign(new Error("injected transient cancel failure"), {
          code: "TEST_TRANSIENT_FAILURE",
        });
      }
      return expireDriverHoldImpl(input);
    };

    const { runPaymentHoldExpiryTickForTests } =
      await import("../../src/finance/start-payment-hold-expiry-scheduler.ts");
    try {
      assert.equal(await runPaymentHoldExpiryTickForTests("2030-01-02T00:00:00.000Z"), 0);
      assert.equal((await dp1GetBooking(driver.id)).status, "approved");
      assert.equal((await dp1GetBooking(rider.id)).status, "approved");
      assert.equal(
        (await holdPort.getByRegistrationId(DP1_TENANT_DENALI, driver.id))?.status,
        "extended",
        "failed atomic expiry keeps the driver hold open for a later retry"
      );

      assert.equal(await runPaymentHoldExpiryTickForTests("2030-01-02T00:01:00.000Z"), 1);
      assert.equal((await dp1GetBooking(driver.id)).status, "cancelled");
      assert.equal((await dp1GetBooking(rider.id)).status, "waitlisted");
      assert.equal(
        (await holdPort.getByRegistrationId(DP1_TENANT_DENALI, driver.id))?.status,
        "expired"
      );
      const riderEvents = peekOutboxByAggregateForTests({
        tenantId: DP1_TENANT_DENALI,
        aggregateId: rider.id,
      }).filter((event) => event.eventType === "registration.waitlisted");
      assert.equal(riderEvents.length, 1, "retry must not duplicate the waitlist lifecycle event");
    } finally {
      repo.expireDriverHoldWithUnpaidPassengers = expireDriverHoldImpl;
    }
  });

  it("recovers dependent rider holds when hold expiry fails after bookings already transitioned", async () => {
    const driver = await createBooking(
      dp1OpsAuth(),
      dp1BookingBody({
        guestLabel: "DP1 Post-Commit Retry Driver",
        partySize: 1,
        tourCapacityMax: 10,
        registrationIntake: {
          transport: { kind: "personal_car", personalCarOccupants: 1 },
        },
      })
    );
    await approveBooking(dp1OpsAuth(), driver.id);

    const rider = await createBooking(
      dp1OpsAuth(),
      dp1BookingBody({
        guestLabel: "DP1 Post-Commit Retry Rider",
        partySize: 1,
        tourCapacityMax: 10,
        registrationIntake: { transport: { kind: "no_car_dong" } },
      })
    );
    const riderOwner = await dp1GetBooking(rider.id);
    await autoApprovePublicBooking({
      tenantId: DP1_TENANT_DENALI,
      bookingId: rider.id,
      actorUserId: riderOwner.submittedByUserId,
    });
    await putTransportAllocations(dp1OpsAuth(), DP1_TOUR_ID, [
      { driverRegistrationId: driver.id, passengerRegistrationId: rider.id },
    ]);

    const holdPort = await requirePaymentHoldPort();
    await holdPort.extend(DP1_TENANT_DENALI, driver.id, "2030-01-01T00:00:00.000Z");
    await holdPort.extend(DP1_TENANT_DENALI, rider.id, "2031-01-01T00:00:00.000Z");

    const holdRepository = getPaymentHoldRepository();
    const markExpired = holdRepository.markExpired.bind(holdRepository);
    let failRiderOnce = true;
    holdRepository.markExpired = async (tenantId, registrationId) => {
      if (registrationId === rider.id && failRiderOnce) {
        failRiderOnce = false;
        throw Object.assign(new Error("injected passenger hold expiry failure"), {
          code: "TEST_PASSENGER_HOLD_EXPIRY_FAILURE",
        });
      }
      return markExpired(tenantId, registrationId);
    };

    const expiry = await import("../../src/finance/payment-hold-expiry.ts");
    try {
      await assert.rejects(
        expiry.expirePaymentHoldForRegistration({
          tenantId: DP1_TENANT_DENALI,
          registrationId: driver.id,
        }),
        /injected passenger hold expiry failure/
      );
      assert.equal((await dp1GetBooking(driver.id)).status, "cancelled");
      assert.equal((await dp1GetBooking(rider.id)).status, "waitlisted");
      assert.equal(
        (await holdPort.getByRegistrationId(DP1_TENANT_DENALI, rider.id))?.status,
        "extended"
      );

      await expiry.expirePaymentHoldForRegistration({
        tenantId: DP1_TENANT_DENALI,
        registrationId: driver.id,
      });

      assert.equal(
        (await holdPort.getByRegistrationId(DP1_TENANT_DENALI, rider.id))?.status,
        "expired",
        "retry must recover and close the dependent rider's hold"
      );
      assert.equal(
        (await holdPort.getByRegistrationId(DP1_TENANT_DENALI, driver.id))?.status,
        "expired"
      );
      const riderEvents = peekOutboxByAggregateForTests({
        tenantId: DP1_TENANT_DENALI,
        aggregateId: rider.id,
      }).filter((event) => event.eventType === "registration.waitlisted");
      assert.equal(riderEvents.length, 1);
    } finally {
      holdRepository.markExpired = markExpired;
    }
  });

  it("waitlists unpaid assigned riders while preserving paid riders and deferring driver expiry", async () => {
    const driver = await createBooking(
      dp1OpsAuth(),
      dp1BookingBody({
        guestLabel: "DP1 Partial-Guard Driver",
        partySize: 1,
        tourCapacityMax: 10,
        registrationIntake: { transport: { kind: "personal_car", personalCarOccupants: 2 } },
      })
    );
    await approveBooking(dp1OpsAuth(), driver.id);

    const riders = await Promise.all(
      ["Unpaid", "Partial"].map((label) =>
        createBooking(
          dp1OpsAuth(),
          dp1BookingBody({
            guestLabel: `DP1 ${label} Assigned Rider`,
            partySize: 1,
            tourCapacityMax: 10,
            registrationIntake: { transport: { kind: "no_car_dong" } },
          })
        )
      )
    );
    for (const rider of riders) {
      const owner = await dp1GetBooking(rider.id);
      await autoApprovePublicBooking({
        tenantId: DP1_TENANT_DENALI,
        bookingId: rider.id,
        actorUserId: owner.submittedByUserId,
      });
    }
    await getBookingsRepository().updatePaymentStatus({
      bookingId: riders[1]!.id,
      tenantId: DP1_TENANT_DENALI,
      paymentStatus: "partial",
    });
    await putTransportAllocations(
      dp1OpsAuth(),
      DP1_TOUR_ID,
      riders.map((rider) => ({
        driverRegistrationId: driver.id,
        passengerRegistrationId: rider.id,
      }))
    );
    const holdPort = await requirePaymentHoldPort();
    await holdPort.extend(DP1_TENANT_DENALI, driver.id, "2030-01-01T00:00:00.000Z");
    await holdPort.extend(DP1_TENANT_DENALI, riders[1]!.id, "2031-01-01T00:00:00.000Z");

    const expiry = await import("../../src/finance/payment-hold-expiry.ts");
    const outcome = await expiry.expirePaymentHoldForRegistration({
      tenantId: DP1_TENANT_DENALI,
      registrationId: driver.id,
    });

    assert.equal(outcome, "deferred");
    assert.equal((await dp1GetBooking(driver.id)).status, "approved");
    assert.equal((await dp1GetBooking(riders[0]!.id)).status, "waitlisted");
    assert.equal((await dp1GetBooking(riders[1]!.id)).status, "approved");
    assert.equal((await dp1GetBooking(riders[1]!.id)).paymentStatus, "partial");
    assert.equal(
      (await holdPort.getByRegistrationId(DP1_TENANT_DENALI, driver.id))?.status,
      "extended"
    );
    assert.equal(
      (await holdPort.getByRegistrationId(DP1_TENANT_DENALI, riders[0]!.id))?.status,
      "expired"
    );
    assert.equal(
      (await holdPort.getByRegistrationId(DP1_TENANT_DENALI, riders[1]!.id))?.status,
      "extended"
    );
    const allocations = listTransportAllocations(DP1_TENANT_DENALI, DP1_TOUR_ID);
    assert.deepEqual(
      allocations.map((allocation) => allocation.passengerRegistrationId),
      [riders[1]!.id],
      "the paid/partial rider keeps their vehicle dependency; unpaid rider is detached"
    );
    assert.equal(
      peekOutboxByAggregateForTests({
        tenantId: DP1_TENANT_DENALI,
        aggregateId: riders[0]!.id,
      }).some((event) => event.eventType === "registration.waitlisted"),
      true
    );
    assert.equal(
      peekOutboxByAggregateForTests({
        tenantId: DP1_TENANT_DENALI,
        aggregateId: riders[0]!.id,
      }).filter((event) => event.eventType === "payment.hold.expired").length,
      1,
      "the unpaid rider's hold closure is observable exactly once"
    );
    assert.equal(
      peekOutboxByAggregateForTests({
        tenantId: DP1_TENANT_DENALI,
        aggregateId: riders[1]!.id,
      }).some((event) => event.eventType === "payment.hold.expired"),
      false,
      "the partial rider's hold remains untouched while driver expiry is deferred"
    );

    const { runPaymentHoldExpiryTickForTests } =
      await import("../../src/finance/start-payment-hold-expiry-scheduler.ts");
    assert.equal(await runPaymentHoldExpiryTickForTests("2030-01-02T00:00:00.000Z"), 0);
    assert.equal(await runPaymentHoldExpiryTickForTests("2030-01-03T00:00:00.000Z"), 0);
    assert.equal((await dp1GetBooking(driver.id)).status, "approved");
    assert.equal(
      peekOutboxByAggregateForTests({
        tenantId: DP1_TENANT_DENALI,
        aggregateId: riders[0]!.id,
      }).filter((event) => event.eventType === "registration.waitlisted").length,
      1,
      "repeated deferred scheduler ticks must not duplicate the waitlist transition"
    );
  });

  it("does not expire a driver's hold after its due date was extended during the read-to-write gap", async () => {
    const driver = await createBooking(
      dp1OpsAuth(),
      dp1BookingBody({
        guestLabel: "DP1 Extended Before Driver Expiry",
        partySize: 1,
        tourCapacityMax: 10,
        registrationIntake: {
          transport: { kind: "personal_car", personalCarOccupants: 1 },
        },
      })
    );
    await approveBooking(dp1OpsAuth(), driver.id);

    const holdPort = await requirePaymentHoldPort();
    await holdPort.extend(DP1_TENANT_DENALI, driver.id, "2030-01-01T00:00:00.000Z");
    const repo = getBookingsRepository();
    const expireImpl = repo.expireDriverHoldWithUnpaidPassengers.bind(repo);
    repo.expireDriverHoldWithUnpaidPassengers = async (input) => {
      await holdPort.extend(DP1_TENANT_DENALI, driver.id, "2032-01-01T00:00:00.000Z");
      return expireImpl(input);
    };

    try {
      const expiry = await import("../../src/finance/payment-hold-expiry.ts");
      assert.equal(
        await expiry.expirePaymentHoldForRegistration({
          tenantId: DP1_TENANT_DENALI,
          registrationId: driver.id,
        }),
        "unchanged"
      );
      assert.equal((await dp1GetBooking(driver.id)).status, "approved");
      const currentHold = await holdPort.getByRegistrationId(DP1_TENANT_DENALI, driver.id);
      assert.equal(currentHold?.status, "extended");
      assert.equal(currentHold?.dueAt, "2032-01-01T00:00:00.000Z");
    } finally {
      repo.expireDriverHoldWithUnpaidPassengers = expireImpl;
    }
  });

  it("keeps an oversized transport-incompatible waitlist candidate queued without failing promotion", async () => {
    const driver = await createBooking(
      dp1OpsAuth(),
      dp1BookingBody({
        guestLabel: "DP1 Promotion Car Driver",
        partySize: 1,
        tourCapacityMax: 10,
        registrationIntake: {
          transport: { kind: "personal_car", personalCarOccupants: 1 },
        },
      })
    );
    await approveBooking(dp1OpsAuth(), driver.id);

    const rider = await createBooking(
      dp1OpsAuth(),
      dp1BookingBody({
        guestLabel: "DP1 Promotion Dong Rider",
        partySize: 1,
        tourCapacityMax: 10,
        registrationIntake: { transport: { kind: "no_car_dong" } },
      })
    );
    const riderOwner = await dp1GetBooking(rider.id);
    await autoApprovePublicBooking({
      tenantId: DP1_TENANT_DENALI,
      bookingId: rider.id,
      actorUserId: riderOwner.submittedByUserId,
    });

    const candidate = await createBooking(
      dp1OpsAuth(),
      dp1BookingBody({
        guestLabel: "DP1 Promotion Waitlist Dong",
        partySize: 1,
        tourCapacityMax: 10,
        registrationIntake: { transport: { kind: "no_car_dong" } },
      })
    );
    await waitlistBooking(dp1OpsAuth(), candidate.id);

    const { promoteOldestWaitlistedGuest } =
      await import("../../src/bookings/promote-waitlist-after-seat-release.ts");
    assert.equal(
      await promoteOldestWaitlistedGuest({
        tenantId: DP1_TENANT_DENALI,
        tourId: candidate.tourId,
      }),
      null
    );
    assert.equal((await dp1GetBooking(candidate.id)).status, "waitlisted");
    const holdPort = await requirePaymentHoldPort();
    assert.equal(await holdPort.getByRegistrationId(DP1_TENANT_DENALI, candidate.id), null);
  });

  it("BUG-STG-063: promotion keeps a group waitlisted when released seats do not fit its partySize", async () => {
    // Create the large candidate before occupancy exists, then fill most seats with
    // an approved booking. Releasing that booking leaves fewer seats than the candidate needs.
    const groupCandidate = await createBooking(
      dp1OpsAuth(),
      dp1BookingBody({ guestLabel: "DP1 Group Candidate", partySize: 12 })
    );
    const blockingBooking = await createBooking(
      dp1OpsAuth(),
      dp1BookingBody({ guestLabel: "DP1 Blocking Booking", partySize: 1 })
    );
    const retainedBooking = await createBooking(
      dp1OpsAuth(),
      dp1BookingBody({ guestLabel: "DP1 Retained Booking", partySize: 1 })
    );
    await approveBooking(dp1OpsAuth(), blockingBooking.id);
    await approveBooking(dp1OpsAuth(), retainedBooking.id);
    await waitlistBooking(dp1OpsAuth(), groupCandidate.id);

    await cancelBooking(dp1OpsAuth(), blockingBooking.id);

    const candidate = await dp1GetBooking(groupCandidate.id);
    assert.equal(candidate.status, "waitlisted");
    const holdPort = await requirePaymentHoldPort();
    assert.equal(await holdPort.getByRegistrationId(DP1_TENANT_DENALI, groupCandidate.id), null);
    const quotePort = (await import("../../src/finance/commercial-quote-approve.service.ts")) as {
      createCommercialQuoteApproveServiceForTests: () => {
        getActiveQuote(
          tenantId: string,
          registrationId: string
        ): Promise<{ status: string } | null>;
      };
    };
    assert.equal(
      await quotePort
        .createCommercialQuoteApproveServiceForTests()
        .getActiveQuote(DP1_TENANT_DENALI, groupCandidate.id),
      null
    );
  });
});
