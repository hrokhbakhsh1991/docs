/**
 * PR23-D2 — tour collection AR aggregation from outstanding invoices.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { createFinanceService } from "../src/application/finance.service.ts";
import {
  aggregateTourCollectionFromOutstanding,
  paginateTourCollectionItems,
} from "../src/domain/tour-collection-summary.ts";
import type { OutstandingBalanceItem } from "../src/domain/outstanding-balance.ts";
import type { FinanceActorContext } from "../src/ports/finance-actor-context.ts";
import type { FinanceObligationPort } from "../src/ports/finance-receipt-defaults.port.ts";
import type {
  FinanceRegistrationDisplay,
  RegistrationDisplayPort,
} from "../src/ports/registration-display.port.ts";
import {
  FakeCapability,
  FakeAuthz,
  FakeClock,
  FakeLogger,
  FakeMetrics,
  FakeProof,
  FakeReceiptDefaults,
  FakeSchedules,
  FakeStorage,
  createFakeBookingPort,
  createFakeLedgerPolicy,
} from "./isolation/fakes.ts";
import {
  InMemoryFinanceRepository,
  resetInMemoryFinanceRepositoryForTests,
} from "./isolation/in-memory-finance.repository.ts";

const PKG_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TENANT = "00000000-0000-4000-8000-000000000099";
const AUTH: FinanceActorContext = {
  userId: "00000000-0000-4000-8000-000000000001",
  tenantId: TENANT,
  role: "admin",
  status: "ACTIVE",
  workspaceId: "ws-tour-collections-d2",
};

const TOUR_A = "11111111-1111-4111-8111-111111111111";
const TOUR_B = "22222222-2222-4222-8222-222222222222";

function offlineObligation(amountMinor = "2500000"): FinanceObligationPort {
  return {
    async resolveRegistrationObligation() {
      return { currency: "IRR", obligationMinor: amountMinor, source: "tour_canonical" };
    },
    async resolveRegistrationPaymentCollection() {
      return "offline";
    },
    async setRegistrationObligationOverride() {
      return false;
    },
  };
}

function displayFor(
  map: ReadonlyMap<string, { tourId: string; tourTitle: string; member: string }>
): RegistrationDisplayPort {
  return {
    async getByRegistrationIds(_tenantId, registrationIds) {
      const out = new Map<string, FinanceRegistrationDisplay>();
      for (const id of registrationIds) {
        const row = map.get(id);
        if (row === undefined) {
          continue;
        }
        out.set(id, {
          registrationId: id,
          tourId: row.tourId,
          tourTitle: row.tourTitle,
          memberDisplayName: row.member,
        });
      }
      return out;
    },
    async listRegistrationIdsByTourId() {
      return [];
    },
  };
}

function createService(
  repo: InMemoryFinanceRepository,
  display: RegistrationDisplayPort,
  booking = createFakeBookingPort(),
  obligation: FinanceObligationPort = offlineObligation()
) {
  return createFinanceService(
    createFakeLedgerPolicy(),
    repo,
    booking,
    FakeReceiptDefaults,
    display,
    FakeMetrics,
    FakeStorage,
    FakeProof,
    FakeCapability,
    FakeAuthz,
    FakeSchedules,
    FakeLogger,
    FakeClock,
    obligation
  );
}

function outstandingRow(input: {
  registrationId: string;
  tourId: string;
  tourTitle: string;
  total: string;
  paid: string;
  remaining: string;
}): OutstandingBalanceItem {
  return {
    registrationId: input.registrationId,
    identity: {
      memberDisplayName: "M",
      tourTitle: input.tourTitle,
      tourId: input.tourId,
    },
    invoice: {
      totalMinor: input.total,
      paidMinor: input.paid,
      remainingMinor: input.remaining,
      currency: "IRR",
    },
    bookingPaymentStatus: "unpaid",
    occurredAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("tour-collections PR23-D2", () => {
  beforeEach(() => {
    resetInMemoryFinanceRepositoryForTests();
  });

  it("D2-A — two registrations same tour aggregate correctly", async () => {
    const booking = createFakeBookingPort();
    const repo = new InMemoryFinanceRepository(booking);
    const reg1 = randomUUID();
    const reg2 = randomUUID();
    const display = displayFor(
      new Map([
        [reg1, { tourId: TOUR_A, tourTitle: "Alborz", member: "Ada" }],
        [reg2, { tourId: TOUR_A, tourTitle: "Alborz", member: "Bob" }],
      ])
    );
    const finance = createService(repo, display, booking, offlineObligation("1000000"));
    await finance.createManualPayment(
      AUTH,
      { registrationId: reg1, amount: "100000", currency: "IRR" },
      "idem-d2-a1"
    );
    await finance.createManualPayment(
      AUTH,
      { registrationId: reg2, amount: "100000", currency: "IRR" },
      "idem-d2-a2"
    );

    const page = await finance.listTourCollectionSummary(AUTH, { limit: 50 });
    const hit = page.items.find((item) => item.tourId === TOUR_A);
    assert.ok(hit);
    assert.equal(hit.registrationsCount, 2);
    assert.equal(hit.tourTitle, "Alborz");
    assert.ok(BigInt(hit.remainingMinor) > 0n);
    assert.equal(BigInt(hit.invoiceTotalMinor), BigInt(hit.collectedMinor) + BigInt(hit.remainingMinor));
  });

  it("D2-B — different tours stay separate", async () => {
    const booking = createFakeBookingPort();
    const repo = new InMemoryFinanceRepository(booking);
    const regA = randomUUID();
    const regB = randomUUID();
    const display = displayFor(
      new Map([
        [regA, { tourId: TOUR_A, tourTitle: "Alborz", member: "Ada" }],
        [regB, { tourId: TOUR_B, tourTitle: "Caspian", member: "Bob" }],
      ])
    );
    const finance = createService(repo, display, booking, offlineObligation("2000000"));
    await finance.createManualPayment(
      AUTH,
      { registrationId: regA, amount: "100000", currency: "IRR" },
      "idem-d2-b1"
    );
    await finance.createManualPayment(
      AUTH,
      { registrationId: regB, amount: "100000", currency: "IRR" },
      "idem-d2-b2"
    );

    const page = await finance.listTourCollectionSummary(AUTH, { limit: 50 });
    assert.equal(page.items.filter((item) => item.tourId === TOUR_A).length, 1);
    assert.equal(page.items.filter((item) => item.tourId === TOUR_B).length, 1);
  });

  it("D2-C — remaining from invoice; pending payment does not inflate collected", async () => {
    const booking = createFakeBookingPort();
    const repo = new InMemoryFinanceRepository(booking);
    const reg = randomUUID();
    const display = displayFor(
      new Map([[reg, { tourId: TOUR_A, tourTitle: "Alborz", member: "Ada" }]])
    );
    const finance = createService(repo, display, booking, offlineObligation("2500000"));
    await finance.createManualPayment(
      AUTH,
      { registrationId: reg, amount: "900000", currency: "IRR" },
      "idem-d2-c"
    );

    const page = await finance.listTourCollectionSummary(AUTH, { limit: 50 });
    const hit = page.items.find((item) => item.tourId === TOUR_A);
    assert.ok(hit);
    // Pending payment is not Paid → collected stays wallet/paid path only (0 paid payments).
    assert.equal(hit.collectedMinor, "0");
    assert.equal(hit.remainingMinor, "2500000");
    assert.equal(hit.invoiceTotalMinor, "2500000");
  });

  it("D2-D — cancelled payment does not remove remaining", async () => {
    const booking = createFakeBookingPort();
    const repo = new InMemoryFinanceRepository(booking);
    const reg = randomUUID();
    const display = displayFor(
      new Map([[reg, { tourId: TOUR_A, tourTitle: "Alborz", member: "Ada" }]])
    );
    const finance = createService(repo, display, booking, offlineObligation("2500000"));
    const payment = await finance.createManualPayment(
      AUTH,
      { registrationId: reg, amount: "900000", currency: "IRR" },
      "idem-d2-d"
    );
    await finance.cancelPendingManualPayment(AUTH, {
      paymentId: payment.id,
      reasonCode: "abandoned",
    });

    const page = await finance.listTourCollectionSummary(AUTH, { limit: 50 });
    const hit = page.items.find((item) => item.tourId === TOUR_A);
    assert.ok(hit);
    assert.ok(BigInt(hit.remainingMinor) > 0n);
  });

  it("D2-E — pure aggregate ignores ledger / payment-row invention", () => {
    const rows = [
      outstandingRow({
        registrationId: "r1",
        tourId: TOUR_A,
        tourTitle: "Alborz",
        total: "1000",
        paid: "200",
        remaining: "800",
      }),
      outstandingRow({
        registrationId: "r2",
        tourId: TOUR_A,
        tourTitle: "Alborz",
        total: "500",
        paid: "0",
        remaining: "500",
      }),
      outstandingRow({
        registrationId: "r3",
        tourId: TOUR_B,
        tourTitle: "Caspian",
        total: "300",
        paid: "0",
        remaining: "300",
      }),
    ];
    const tours = aggregateTourCollectionFromOutstanding(rows);
    const a = tours.find((t) => t.tourId === TOUR_A);
    const b = tours.find((t) => t.tourId === TOUR_B);
    assert.ok(a);
    assert.ok(b);
    assert.equal(a.registrationsCount, 2);
    assert.equal(a.invoiceTotalMinor, "1500");
    assert.equal(a.collectedMinor, "200");
    assert.equal(a.remainingMinor, "1300");
    assert.equal(b.remainingMinor, "300");
  });

  it("D2-F — cursor continuation + remaining DESC ordering", () => {
    const high = {
      tourId: TOUR_A,
      tourTitle: "High",
      registrationsCount: 1,
      invoiceTotalMinor: "5000",
      collectedMinor: "0",
      remainingMinor: "5000",
      currency: "IRR",
    };
    const low = {
      tourId: TOUR_B,
      tourTitle: "Low",
      registrationsCount: 1,
      invoiceTotalMinor: "100",
      collectedMinor: "0",
      remainingMinor: "100",
      currency: "IRR",
    };
    const first = paginateTourCollectionItems({ items: [low, high], limit: 1 });
    assert.equal(first.items[0]?.tourId, TOUR_A);
    assert.equal(first.hasMore, true);
    const rest = paginateTourCollectionItems({
      items: [low, high],
      limit: 10,
      cursor: first.nextCursor,
    });
    assert.equal(rest.items[0]?.tourId, TOUR_B);
  });

  it("D2-G — boundary: D2 uses outstanding path; no gateway / payment aggregate / mutation", () => {
    const service = readFileSync(
      resolve(PKG_ROOT, "src/application/finance.service.ts"),
      "utf8"
    );
    const start = service.indexOf("async listTourCollectionSummary");
    assert.ok(start > 0);
    const end = service.indexOf("async listPendingReceipts", start);
    assert.ok(end > start);
    const body = service.slice(start, end);
    assert.match(body, /loadOutstandingBalanceItems/);
    assert.match(body, /aggregateTourCollectionFromOutstanding/);
    assert.doesNotMatch(body, /listPaymentsByTourAggregate|listOpenPayments|listLedgerEvents/);
    assert.doesNotMatch(body, /stripe|psp|gateway|refund|credit.?note/i);
    assert.doesNotMatch(body, /createManualPayment|cancelPending|reviewReceipt/);

    const doc = readFileSync(
      resolve(
        PKG_ROOT,
        "../../docs/phase-20/p7/appendices/FINANCE_TOUR_COLLECTION_REPORT_PR23_D2.md"
      ),
      "utf8"
    );
    assert.match(doc, /Invoice-based aggregation/);
    assert.match(doc, /Payment ops vs AR/);
    assert.match(doc, /manual\/offline/i);
  });
});
