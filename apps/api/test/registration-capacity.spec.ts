/**
 * P5-E-N-002 / N-003 — registration capacity + public throttle
 * @see docs/phase-18/platform-registrations-finance-tranche.mdoc
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import {
  assertRegistrationCapacityDecision,
  isRegistrationCapacityExceededError,
  resolveRegistrationCapacityDecision,
  sumAcceptedRegistrationSeats,
} from "../src/registrations/registration-capacity.service.ts";
import {
  assertPublicRegistrationThrottle,
  isPublicRegistrationThrottleExceededError,
  resetPublicRegistrationThrottleForTests,
} from "../src/registrations/public-registration-throttle.ts";
import "../src/http/configure-product-http-hosts.ts";
import { InMemoryUrbanRegistrationRepository, createUrbanRegistration } from "@app-tour/workspace-urban/host/http";
import { InMemoryTourRepository } from "../src/storage/in-memory-tour.repository.ts";
import { TourStorageDbAdapter } from "../src/db/tour-storage.adapter.ts";

describe("registration-capacity (P5-E REG-01..02)", () => {
  it("REG-01 confirms when seats remain", () => {
    const decision = resolveRegistrationCapacityDecision({
      tourCapacity: 10,
      acceptedSeats: 4,
      requestedPartySize: 2,
      policy: "open",
    });
    assert.equal(assertRegistrationCapacityDecision(decision), "confirmed");
  });

  it("REG-01b unlimited capacity confirms", () => {
    const decision = resolveRegistrationCapacityDecision({
      tourCapacity: null,
      acceptedSeats: 999,
      requestedPartySize: 5,
      policy: "open",
    });
    assert.equal(decision.kind, "accept");
  });

  it("REG-02 waitlists when full under waitlist policy", () => {
    const decision = resolveRegistrationCapacityDecision({
      tourCapacity: 4,
      acceptedSeats: 4,
      requestedPartySize: 1,
      policy: "waitlist",
    });
    assert.equal(assertRegistrationCapacityDecision(decision), "waitlist");
  });

  it("REG-02b open policy rejects when full", () => {
    assert.throws(
      () =>
        assertRegistrationCapacityDecision(
          resolveRegistrationCapacityDecision({
            tourCapacity: 2,
            acceptedSeats: 2,
            requestedPartySize: 1,
            policy: "open",
          })
        ),
      (error: unknown) => {
        assert.ok(isRegistrationCapacityExceededError(error));
        return true;
      }
    );
  });

  it("REG-01c service sums confirmed party sizes from repo rows", async () => {
    const repo = new InMemoryUrbanRegistrationRepository();
    await repo.create({
      tenantId: "tenant-a",
      tourId: "tour-a",
      email: "a@example.com",
      fullName: "A",
      partySize: 2,
      status: "confirmed",
    });
    await repo.create({
      tenantId: "tenant-a",
      tourId: "tour-a",
      email: "b@example.com",
      fullName: "B",
      partySize: 3,
      status: "waitlist",
    });
    assert.equal(await repo.sumAcceptedPartySize("tenant-a", "tour-a"), 2);
    assert.equal(
      sumAcceptedRegistrationSeats([
        { status: "confirmed", partySize: 2 },
        { status: "waitlist", partySize: 5 },
      ]),
      2
    );
  });

  it("REG-01d urban create assigns confirmed then waitlist as seats fill", async () => {
    const store = new TourStorageDbAdapter(new InMemoryTourRepository());
    store.devMemoryStore()?.ensureUrbanPhase81PublishedTour();
    const repo = new InMemoryUrbanRegistrationRepository();

    const first = await createUrbanRegistration({
      tenantId: "00000000-0000-4000-8000-000000000004",
      workspaceType: "urban",
      body: {
        tourId: "00000000-0000-4000-8000-000000000410",
        contact: { email: "first@example.com", fullName: "First Guest" },
        partySize: 99,
      },
      store,
      registrationRepo: repo,
      registrationPolicy: "waitlist",
    });
    assert.equal(first.status, "confirmed");

    const second = await createUrbanRegistration({
      tenantId: "00000000-0000-4000-8000-000000000004",
      workspaceType: "urban",
      body: {
        tourId: "00000000-0000-4000-8000-000000000410",
        contact: { email: "second@example.com", fullName: "Second Guest" },
        partySize: 2,
      },
      store,
      registrationRepo: repo,
      registrationPolicy: "waitlist",
    });
    assert.equal(second.status, "waitlist");
  });
});

describe("public-registration-throttle (P5-E REG-03)", () => {
  const originalLimit = process.env.PUBLIC_REGISTRATION_THROTTLE_PER_MIN;

  beforeEach(() => {
    process.env.PUBLIC_REGISTRATION_THROTTLE_PER_MIN = "2";
    resetPublicRegistrationThrottleForTests();
  });

  afterEach(() => {
    resetPublicRegistrationThrottleForTests();
    if (originalLimit === undefined) {
      delete process.env.PUBLIC_REGISTRATION_THROTTLE_PER_MIN;
    } else {
      process.env.PUBLIC_REGISTRATION_THROTTLE_PER_MIN = originalLimit;
    }
  });

  it("REG-03 allows requests under per-minute limit", async () => {
    await assertPublicRegistrationThrottle("203.0.113.50");
    await assertPublicRegistrationThrottle("203.0.113.50");
  });

  it("REG-03b exceeds limit with 429-class error", async () => {
    await assertPublicRegistrationThrottle("203.0.113.51");
    await assertPublicRegistrationThrottle("203.0.113.51");
    await assert.rejects(
      () => assertPublicRegistrationThrottle("203.0.113.51"),
      (error: unknown) => {
        assert.ok(isPublicRegistrationThrottleExceededError(error));
        assert.equal(error.statusCode, 429);
        return true;
      }
    );
  });
});
