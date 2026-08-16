/**
 * PAY-FIN-02 — memory outstanding candidates must match Prisma operator registrations.
 * Approved unpaid with no Manual Payment / receipt still has invoice remaining.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { after, before, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import type { TenantAuthContext } from "@app-tour/workspace-sdk";

import { resetBookingsRepositoryForTests } from "../bookings/create-bookings-repository.ts";
import { OPERATOR_SMOKE } from "../../test/fixtures/operator-smoke-e2e-tenant.ts";
import { FinanceService } from "./finance.service.ts";
import { BookingPaymentAdapter } from "./infrastructure/booking-payment.adapter.ts";
import { BookingRegistrationDisplayAdapter } from "./infrastructure/booking-registration-display.adapter.ts";
import { DenaliFinanceLedgerPolicyAdapter } from "@app-tour/workspace-denali";
import { DenaliFinanceReceiptDefaultsAdapter } from "@app-tour/workspace-denali";
import {
  InMemoryFinanceRepository,
  resetInMemoryFinanceRepositoryForTests,
} from "./in-memory-finance.repository.ts";
import {
  fakeEmptySchedules,
  fakeFixedClock,
  fakeMemoryPersistenceMode,
  fakeNoopLog,
  fakeNoopMetrics,
  fakePermissiveAccess,
  fakePermissiveCapability,
  fakeReceiptProofUrl,
} from "./finance-service-host-fakes.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const OTHER_TOUR_ID = "00000000-0000-4000-8000-000000000299";

const operatorAuth: TenantAuthContext = {
  userId: OPERATOR_SMOKE.adminUserId,
  tenantId: OPERATOR_SMOKE.tenantId,
  role: "admin",
  status: "ACTIVE",
  workspaceId: "ws-outstanding-memory",
};

const tourObligation = {
  async resolveRegistrationObligation() {
    return {
      obligationMinor: "2500000",
      currency: "IRR",
      source: "tour_canonical" as const,
    };
  },
  async resolveRegistrationPaymentCollection() {
    return "offline" as const;
  },
  async setRegistrationObligationOverride() {
    return false;
  },
};

describe("outstanding-balance memory candidates (PAY-FIN-02)", { concurrency: false }, () => {
  const priorStorageDriver = process.env.STORAGE_DRIVER;
  const priorDatabaseUrl = process.env.DATABASE_URL;

  before(() => {
    process.env.STORAGE_DRIVER = "memory";
    delete process.env.DATABASE_URL;
  });

  after(() => {
    if (priorStorageDriver === undefined) {
      delete process.env.STORAGE_DRIVER;
    } else {
      process.env.STORAGE_DRIVER = priorStorageDriver;
    }
    if (priorDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = priorDatabaseUrl;
    }
  });

  beforeEach(() => {
    resetInMemoryFinanceRepositoryForTests();
    resetBookingsRepositoryForTests();
  });

  function seedApprovedUnpaid(
    bookings: ReturnType<typeof resetBookingsRepositoryForTests>,
    input: {
      readonly registrationId: string;
      readonly tourId?: string;
      readonly guestLabel?: string;
    }
  ): void {
    bookings.seedBooking({
      id: input.registrationId,
      tenantId: OPERATOR_SMOKE.tenantId,
      tourId: input.tourId ?? OPERATOR_SMOKE.seedTourId,
      tourTitle: "North Ridge Trek",
      guestLabel: input.guestLabel ?? "Approved Unpaid Guest",
      guestEmail: null,
      guestPhone: null,
      partySize: 1,
      status: "approved",
      paymentStatus: "unpaid",
      departureAt: "2026-09-01T08:00:00.000Z",
      submittedAt: "2026-08-10T00:00:00.000Z",
      submittedByUserId: OPERATOR_SMOKE.memberUserId,
      approvedAt: "2026-08-12T00:00:00.000Z",
    });
  }

  function createFinance() {
    const bookings = resetBookingsRepositoryForTests();
    const bookingPayments = new BookingPaymentAdapter(bookings);
    const financeRepo = new InMemoryFinanceRepository(bookingPayments, bookings);
    const finance = new FinanceService(
      new DenaliFinanceLedgerPolicyAdapter(),
      financeRepo,
      bookingPayments,
      new DenaliFinanceReceiptDefaultsAdapter(),
      new BookingRegistrationDisplayAdapter(bookings),
      fakeNoopMetrics,
      fakeMemoryPersistenceMode,
      fakeReceiptProofUrl,
      fakePermissiveCapability,
      fakePermissiveAccess,
      fakeEmptySchedules,
      fakeNoopLog,
      fakeFixedClock,
      tourObligation
    );
    return { finance, financeRepo, bookingPayments, bookings };
  }

  it("PAY-FIN-02 — approved unpaid with no payment row is outstanding", async () => {
    const registrationId = randomUUID();
    const { finance, bookings } = createFinance();
    seedApprovedUnpaid(bookings, { registrationId });

    const page = await finance.listOutstandingBalances(operatorAuth, { limit: 50 });
    const hit = page.items.find((item) => item.registrationId === registrationId);
    assert.ok(hit);
    assert.equal(hit.invoice.remainingMinor, "2500000");
    assert.equal(hit.invoice.paidMinor, "0");
    assert.equal(hit.bookingPaymentStatus, "unpaid");
    assert.equal(hit.identity.tourId, OPERATOR_SMOKE.seedTourId);
    assert.equal(hit.identity.memberDisplayName, "Approved Unpaid Guest");
  });

  it("PAY-FIN-02 — tourId filter keeps the approved unpaid guest", async () => {
    const onTour = randomUUID();
    const otherTour = randomUUID();
    const { finance, bookings } = createFinance();
    seedApprovedUnpaid(bookings, { registrationId: onTour, guestLabel: "On Tour" });
    seedApprovedUnpaid(bookings, {
      registrationId: otherTour,
      tourId: OTHER_TOUR_ID,
      guestLabel: "Other Tour",
    });

    const scoped = await finance.listOutstandingBalances(operatorAuth, {
      limit: 50,
      tourId: OPERATOR_SMOKE.seedTourId,
    });
    assert.equal(
      scoped.items.some((item) => item.registrationId === onTour),
      true
    );
    assert.equal(
      scoped.items.some((item) => item.registrationId === otherTour),
      false
    );
  });

  it("PAY-FIN-02 — payment-only fixture without bookings injection still lists from payments", async () => {
    const registrationId = randomUUID();
    const bookingPayments = new BookingPaymentAdapter(resetBookingsRepositoryForTests());
    const financeRepo = new InMemoryFinanceRepository(bookingPayments);
    const finance = new FinanceService(
      new DenaliFinanceLedgerPolicyAdapter(),
      financeRepo,
      bookingPayments,
      new DenaliFinanceReceiptDefaultsAdapter(),
      new BookingRegistrationDisplayAdapter(resetBookingsRepositoryForTests()),
      fakeNoopMetrics,
      fakeMemoryPersistenceMode,
      fakeReceiptProofUrl,
      fakePermissiveCapability,
      fakePermissiveAccess,
      fakeEmptySchedules,
      fakeNoopLog,
      fakeFixedClock,
      tourObligation
    );
    await financeRepo.createManualPayment({
      tenantId: OPERATOR_SMOKE.tenantId,
      registrationId,
      amount: "1000000",
      currency: "IRR",
      method: "Manual",
      provider: "manual",
      status: "Pending",
    });
    const page = await finance.listOutstandingBalances(operatorAuth, { limit: 50 });
    assert.ok(page.items.some((item) => item.registrationId === registrationId));
  });

  it("memory driver pages bookings for candidates; factory injects bookings repo", () => {
    const memorySrc = readFileSync(resolve(HERE, "in-memory-finance.repository.ts"), "utf8");
    assert.match(memorySrc, /listCandidatesFromBookings/);
    assert.match(memorySrc, /listByTenantPage/);
    assert.match(memorySrc, /if \(this\.bookings !== null\)/);
    assert.match(memorySrc, /listCandidatesFromPaymentRows/);

    const factorySrc = readFileSync(resolve(HERE, "finance-repository.factory.ts"), "utf8");
    assert.match(factorySrc, /getBookingsRepository\(\)/);
    assert.match(
      factorySrc,
      /new InMemoryFinanceRepository\(\s*bookingPayments,\s*getBookingsRepository\(\)\s*\)/
    );
  });
});
