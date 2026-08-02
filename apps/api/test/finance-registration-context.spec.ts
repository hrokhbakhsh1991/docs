/**
 * Phase B / 1.6 — finance registration context helpers + display port ownership.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import {
  attachFinanceRegistrationContext,
  filterRowsByRegistrationId,
  type FinanceRegistrationContext,
} from "../src/workspace-finance/finance-registration-context.ts";
import { BookingRegistrationDisplayAdapter } from "../src/workspace-finance/infrastructure/booking-registration-display.adapter.ts";
import {
  getBookingsRepository,
  resetBookingsRepositoryForTests,
} from "../src/bookings/create-bookings-repository.ts";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const WF = "apps/api/src/workspace-finance";
const CORE_APP = "packages/finance-core/src/application";
const CORE_DOMAIN = "packages/finance-core/src/domain";

describe("finance-registration-context.spec.ts", () => {
  it("B-01 filterRowsByRegistrationId keeps only matching rows", () => {
    const rows = [
      { registrationId: "a", amount: "1" },
      { registrationId: "b", amount: "2" },
      { registrationId: "a", amount: "3" },
    ];
    assert.deepEqual(filterRowsByRegistrationId(rows, undefined), rows);
    assert.deepEqual(filterRowsByRegistrationId(rows, "a"), [
      { registrationId: "a", amount: "1" },
      { registrationId: "a", amount: "3" },
    ]);
    assert.deepEqual(filterRowsByRegistrationId(rows, "missing"), []);
  });

  it("B-02 attachFinanceRegistrationContext is null when map lacks id", () => {
    const contexts = new Map<string, FinanceRegistrationContext>();
    const attached = attachFinanceRegistrationContext(
      { registrationId: "reg-1", id: "pay-1" },
      contexts
    );
    assert.equal(attached.registrationContext, null);
    assert.equal(attached.registrationId, "reg-1");
  });

  it("B-03 attachFinanceRegistrationContext copies projection fields", () => {
    const ctx: FinanceRegistrationContext = {
      registrationId: "reg-1",
      tourId: "tour-1",
      tourTitle: "North Ridge",
      memberDisplayName: "Ali",
    };
    const contexts = new Map([["reg-1", ctx]]);
    const attached = attachFinanceRegistrationContext(
      { registrationId: "reg-1", id: "pay-1" },
      contexts
    );
    assert.deepEqual(attached.registrationContext, ctx);
  });

  it("FIN-P1.6-01 finance-registration-context.ts has no Booking repository imports", () => {
    const src = readFileSync(resolve(REPO_ROOT, `${CORE_DOMAIN}/finance-registration-context.ts`), "utf8");
    assert.doesNotMatch(src, /getBookingsRepository/);
    assert.doesNotMatch(src, /create-bookings-repository/);
    assert.doesNotMatch(src, /from ["'].*bookings\//);
  });

  it("FIN-P1.6-02 FinanceService loads display via registrationDisplay port", () => {
    const src = readFileSync(resolve(REPO_ROOT, `${CORE_APP}/finance.service.ts`), "utf8");
    assert.match(src, /registrationDisplay\.getByRegistrationIds/);
    assert.doesNotMatch(src, /loadFinanceRegistrationContextMap/);
    assert.doesNotMatch(src, /getBookingsRepository/);
  });

  it("FIN-P1.6-03 BookingRegistrationDisplayAdapter maps guestLabel → memberDisplayName", async () => {
    const prior = process.env.STORAGE_DRIVER;
    process.env.STORAGE_DRIVER = "memory";
    resetBookingsRepositoryForTests();
    try {
      const registrationId = "00000000-0000-4000-8000-000000000161";
      const tenantId = "00000000-0000-4000-8000-000000000001";
      getBookingsRepository().seedBooking({
        id: registrationId,
        tenantId,
        tourId: "tour-display",
        tourTitle: "Display Tour",
        guestLabel: "Display Guest",
        guestEmail: null,
        guestPhone: null,
        partySize: 1,
        status: "approved",
        paymentStatus: "unpaid",
        departureAt: "2026-08-01T00:00:00.000Z",
        submittedAt: "2026-07-01T00:00:00.000Z",
        submittedByUserId: "user-1",
        approvedAt: null,
      });
      const adapter = new BookingRegistrationDisplayAdapter(getBookingsRepository());
      const map = await adapter.getByRegistrationIds(tenantId, [registrationId]);
      assert.deepEqual(map.get(registrationId), {
        registrationId,
        tourId: "tour-display",
        tourTitle: "Display Tour",
        memberDisplayName: "Display Guest",
      });
    } finally {
      if (prior === undefined) {
        delete process.env.STORAGE_DRIVER;
      } else {
        process.env.STORAGE_DRIVER = prior;
      }
      resetBookingsRepositoryForTests();
    }
  });
});
