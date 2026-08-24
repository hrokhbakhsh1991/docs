/**
 * DP-2 API integration — operational roster projection.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, beforeEach, describe, it } from "node:test";

import type { FinanceActorContext } from "@app-tour/finance-core/ports";

import { resolveFinanceServiceForTenant } from "../../src/boot/lazy-finance-service.ts";
import {
  approveBooking,
  createBooking,
  waitlistBooking,
} from "../../src/bookings/create-bookings-service.ts";
import { listTourOperationalRoster } from "../../src/roster/operational-roster.service.ts";
import {
  DP1_TENANT_DENALI,
  DP1_TOUR_ID,
  dp1BookingBody,
  dp1OpsAuth,
  resetDp1MemoryHarness,
} from "../dp1/dp1-test-harness.ts";

function financeAuth(): FinanceActorContext {
  return {
    tenantId: DP1_TENANT_DENALI,
    userId: "00000000-0000-4000-8000-000000000201",
    role: "admin",
    status: "ACTIVE",
    workspaceId: "ws-dp2-roster",
  };
}

describe("DP-2 operational roster projection", { concurrency: false }, () => {
  before(() => resetDp1MemoryHarness());
  beforeEach(() => resetDp1MemoryHarness());
  after(() => resetDp1MemoryHarness());

  it("matrix: approved unpaid appears in operational + unpaid filters", async () => {
    const created = await createBooking(dp1OpsAuth(), dp1BookingBody());
    await approveBooking(dp1OpsAuth(), created.id);

    const operational = await listTourOperationalRoster(dp1OpsAuth(), DP1_TOUR_ID, {
      view: "ops",
      filter: "operational",
      limit: 50,
    });
    const unpaid = await listTourOperationalRoster(dp1OpsAuth(), DP1_TOUR_ID, {
      view: "ops",
      filter: "unpaid",
      limit: 50,
    });

    const row = operational.items.find((item) => item.registrationId === created.id);
    assert.ok(row, "approved row missing from operational roster");
    assert.equal(row.isOperationalParticipant, true);
    assert.equal(row.isFinalParticipant, false);
    assert.equal(row.financialDisplayState, "UNPAID");
    assert.ok(unpaid.items.some((item) => item.registrationId === created.id));
  });

  it("matrix: partial payment stays non-final", async () => {
    const created = await createBooking(dp1OpsAuth(), dp1BookingBody());
    await approveBooking(dp1OpsAuth(), created.id);
    const finance = await resolveFinanceServiceForTenant(DP1_TENANT_DENALI);
    await finance.createManualPayment(
      financeAuth(),
      { registrationId: created.id, amount: "1000000", currency: "IRR" },
      `dp2-partial-${randomUUID()}`
    );

    const roster = await listTourOperationalRoster(dp1OpsAuth(), DP1_TOUR_ID, {
      view: "ops",
      filter: "operational",
      limit: 50,
    });
    const row = roster.items.find((item) => item.registrationId === created.id);
    assert.ok(row);
    assert.equal(row.financialDisplayState, "PARTIALLY_PAID");
    assert.equal(row.isFinalParticipant, false);
  });

  it("matrix: full payment yields final + paid filters", async () => {
    const created = await createBooking(dp1OpsAuth(), dp1BookingBody());
    await approveBooking(dp1OpsAuth(), created.id);
    const finance = await resolveFinanceServiceForTenant(DP1_TENANT_DENALI);
    const invoice = await finance.getRegistrationInvoice(financeAuth(), created.id);
    await finance.createManualPayment(
      financeAuth(),
      {
        registrationId: created.id,
        amount: invoice.invoiceTotalMinor,
        currency: "IRR",
      },
      `dp2-paid-${randomUUID()}`
    );

    const paid = await listTourOperationalRoster(dp1OpsAuth(), DP1_TOUR_ID, {
      view: "ops",
      filter: "paid",
      limit: 50,
    });
    const final = await listTourOperationalRoster(dp1OpsAuth(), DP1_TOUR_ID, {
      view: "ops",
      filter: "final",
      limit: 50,
    });
    const row = paid.items.find((item) => item.registrationId === created.id);
    assert.ok(row);
    assert.equal(row.isFinalParticipant, true);
    assert.equal(row.financialDisplayState, "PAID");
    assert.ok(final.items.some((item) => item.registrationId === created.id));
  });

  it("matrix: waitlisted row appears only in waitlist filter", async () => {
    const created = await createBooking(dp1OpsAuth(), dp1BookingBody());
    await waitlistBooking(dp1OpsAuth(), created.id);

    const waitlist = await listTourOperationalRoster(dp1OpsAuth(), DP1_TOUR_ID, {
      view: "ops",
      filter: "waitlist",
      limit: 50,
    });
    const operational = await listTourOperationalRoster(dp1OpsAuth(), DP1_TOUR_ID, {
      view: "ops",
      filter: "operational",
      limit: 50,
    });

    assert.ok(waitlist.items.some((item) => item.registrationId === created.id));
    assert.equal(
      operational.items.some((item) => item.registrationId === created.id),
      false
    );
  });

  it("driver offer and passenger assignment honest", async () => {
    const body = {
      ...dp1BookingBody({ guestLabel: "Driver Guest" }),
      registrationIntake: {
        tourCapacityMax: 10,
        transport: { kind: "personal_car", personalCarOccupants: 2 },
      },
    };
    const created = await createBooking(dp1OpsAuth(), body);
    await approveBooking(dp1OpsAuth(), created.id);

    const roster = await listTourOperationalRoster(dp1OpsAuth(), DP1_TOUR_ID, {
      view: "ops",
      filter: "operational",
      limit: 50,
    });
    const row = roster.items.find((item) => item.registrationId === created.id);
    assert.ok(row);
    assert.equal(row.isDriverOffer, true);
    assert.equal(row.passengerAssignmentStatus, "not_implemented");
  });
});
