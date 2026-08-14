/**
 * PR23-D1 — outstanding balance AR read model (invoice SoT).
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { createFinanceService } from "../src/application/finance.service.ts";
import {
  encodeOutstandingBalanceCursor,
  paginateOutstandingBalanceItems,
} from "../src/domain/outstanding-balance.ts";
import type { FinanceActorContext } from "../src/ports/finance-actor-context.ts";
import type { FinanceObligationPort } from "../src/ports/finance-receipt-defaults.port.ts";
import {
  FakeCapability,
  FakeAuthz,
  FakeClock,
  FakeDisplay,
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
const TENANT_B = "00000000-0000-4000-8000-000000000098";
const AUTH: FinanceActorContext = {
  userId: "00000000-0000-4000-8000-000000000001",
  tenantId: TENANT,
  role: "admin",
  status: "ACTIVE",
  workspaceId: "ws-outstanding-d1",
};
const AUTH_B: FinanceActorContext = {
  ...AUTH,
  tenantId: TENANT_B,
  workspaceId: "ws-outstanding-d1-b",
};

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

function createService(
  repo: InMemoryFinanceRepository,
  booking = createFakeBookingPort(),
  obligation: FinanceObligationPort = offlineObligation(),
  display: typeof FakeDisplay = FakeDisplay
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

describe("outstanding-balances PR23-D1", () => {
  beforeEach(() => {
    resetInMemoryFinanceRepositoryForTests();
  });

  it("D1-A — invoice remaining > 0 appears", async () => {
    const booking = createFakeBookingPort();
    const repo = new InMemoryFinanceRepository(booking);
    const finance = createService(repo, booking, offlineObligation("2500000"));
    const registrationId = randomUUID();
    await finance.createManualPayment(
      AUTH,
      { registrationId, amount: "1000000", currency: "IRR" },
      "idem-d1-a"
    );

    const page = await finance.listOutstandingBalances(AUTH, { limit: 50 });
    const hit = page.items.find((item) => item.registrationId === registrationId);
    assert.ok(hit);
    assert.ok(BigInt(hit.invoice.remainingMinor.replace(/\D/g, "")) > 0n);
    assert.equal(hit.invoice.currency, "IRR");
    assert.ok(hit.invoice.totalMinor.length > 0);
  });

  it("D1-B — zero remaining / paid registration absent", async () => {
    const booking = createFakeBookingPort();
    const repo = new InMemoryFinanceRepository(booking);
    const finance = createService(repo, booking, offlineObligation("1000000"));
    const registrationId = randomUUID();
    const payment = await finance.createManualPayment(
      AUTH,
      { registrationId, amount: "1000000", currency: "IRR" },
      "idem-d1-b-pay"
    );
    const receipt = await finance.submitReceipt(
      AUTH,
      { paymentId: payment.id, fileKey: `receipts/${payment.id}.jpg` },
      "idem-d1-b-rcpt"
    );
    await finance.reviewReceipt(AUTH, receipt.id, { decision: "approve" });

    const page = await finance.listOutstandingBalances(AUTH, { limit: 50 });
    assert.equal(
      page.items.some((item) => item.registrationId === registrationId),
      false
    );
  });

  it("D1-C — Cancelled payment is not the debt source; invoice remaining still gates", async () => {
    const booking = createFakeBookingPort();
    const repo = new InMemoryFinanceRepository(booking);
    const finance = createService(repo, booking, offlineObligation("2500000"));
    const registrationId = randomUUID();
    const payment = await finance.createManualPayment(
      AUTH,
      { registrationId, amount: "1000000", currency: "IRR" },
      "idem-d1-c"
    );
    await finance.cancelPendingManualPayment(AUTH, {
      paymentId: payment.id,
      reasonCode: "abandoned",
    });

    const page = await finance.listOutstandingBalances(AUTH, { limit: 50 });
    const hit = page.items.find((item) => item.registrationId === registrationId);
    assert.ok(hit, "remaining comes from invoice, not Cancelled payment row");
    assert.ok(BigInt(hit.invoice.remainingMinor.replace(/\D/g, "")) > 0n);
  });

  it("D1-D — tenant isolation", async () => {
    const booking = createFakeBookingPort();
    const repo = new InMemoryFinanceRepository(booking);
    const finance = createService(repo, booking);
    const regA = randomUUID();
    const regB = randomUUID();
    await finance.createManualPayment(
      AUTH,
      { registrationId: regA, amount: "1000000", currency: "IRR" },
      "idem-d1-a-tenant"
    );
    await finance.createManualPayment(
      AUTH_B,
      { registrationId: regB, amount: "1000000", currency: "IRR" },
      "idem-d1-b-tenant"
    );

    const pageA = await finance.listOutstandingBalances(AUTH, { limit: 50 });
    const pageB = await finance.listOutstandingBalances(AUTH_B, { limit: 50 });
    assert.equal(pageA.items.some((item) => item.registrationId === regB), false);
    assert.equal(pageB.items.some((item) => item.registrationId === regA), false);
    assert.equal(pageA.items.some((item) => item.registrationId === regA), true);
    assert.equal(pageB.items.some((item) => item.registrationId === regB), true);
  });

  it("D1-E — cursor continuation + stable oldest-first ordering", async () => {
    const booking = createFakeBookingPort();
    const repo = new InMemoryFinanceRepository(booking);
    const finance = createService(repo, booking, offlineObligation("2500000"));
    const firstId = randomUUID();
    const secondId = randomUUID();
    await finance.createManualPayment(
      AUTH,
      { registrationId: firstId, amount: "500000", currency: "IRR" },
      "idem-d1-order-1"
    );
    await new Promise((r) => setTimeout(r, 5));
    await finance.createManualPayment(
      AUTH,
      { registrationId: secondId, amount: "500000", currency: "IRR" },
      "idem-d1-order-2"
    );

    const page1 = await finance.listOutstandingBalances(AUTH, { limit: 1 });
    assert.equal(page1.items.length, 1);
    assert.equal(page1.hasMore, true);
    assert.ok(page1.nextCursor);
    assert.equal(page1.items[0]?.registrationId, firstId);

    const page2 = await finance.listOutstandingBalances(AUTH, {
      limit: 50,
      cursor: page1.nextCursor,
    });
    assert.ok(page2.items.some((item) => item.registrationId === secondId));
    assert.equal(
      page2.items.some((item) => item.registrationId === firstId),
      false
    );
  });

  it("D1-H — optional tourId filters after identity enrich, before pagination", async () => {
    const booking = createFakeBookingPort();
    const repo = new InMemoryFinanceRepository(booking);
    const tourA = randomUUID();
    const tourB = randomUUID();
    const regA = randomUUID();
    const regB = randomUUID();
    const display = {
      async getByRegistrationIds(_tenantId: string, ids: readonly string[]) {
        const map = new Map<
          string,
          {
            registrationId: string;
            memberDisplayName: string;
            tourTitle: string;
            tourId: string;
          }
        >();
        for (const id of ids) {
          if (id === regA) {
            map.set(id, {
              registrationId: id,
              memberDisplayName: "A",
              tourTitle: "Tour A",
              tourId: tourA,
            });
          }
          if (id === regB) {
            map.set(id, {
              registrationId: id,
              memberDisplayName: "B",
              tourTitle: "Tour B",
              tourId: tourB,
            });
          }
        }
        return map;
      },
      async listRegistrationIdsByTourId() {
        return [];
      },
    };
    const finance = createService(repo, booking, offlineObligation("2500000"), display);
    await finance.createManualPayment(
      AUTH,
      { registrationId: regA, amount: "1000000", currency: "IRR" },
      "idem-d1-h-a"
    );
    await finance.createManualPayment(
      AUTH,
      { registrationId: regB, amount: "1000000", currency: "IRR" },
      "idem-d1-h-b"
    );

    const scoped = await finance.listOutstandingBalances(AUTH, {
      limit: 50,
      tourId: tourA,
    });
    assert.equal(scoped.items.length, 1);
    assert.equal(scoped.items[0]?.registrationId, regA);
    assert.equal(scoped.items[0]?.identity.tourId, tourA);

    const all = await finance.listOutstandingBalances(AUTH, { limit: 50 });
    assert.ok(all.items.length >= 2);
  });

  it("D1-F — pagination helper keyset uses registration clock, not payment amount", () => {
    const early = {
      registrationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      identity: { memberDisplayName: null, tourTitle: null, tourId: null },
      invoice: {
        totalMinor: "100",
        paidMinor: "0",
        remainingMinor: "100",
        currency: "IRR",
      },
      bookingPaymentStatus: null,
      occurredAt: "2026-01-01T00:00:00.000Z",
    };
    const late = {
      ...early,
      registrationId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      occurredAt: "2026-02-01T00:00:00.000Z",
      invoice: {
        totalMinor: "999999",
        paidMinor: "0",
        remainingMinor: "999999",
        currency: "IRR",
      },
    };
    const page = paginateOutstandingBalanceItems({
      items: [late, early],
      limit: 1,
    });
    assert.equal(page.items[0]?.registrationId, early.registrationId);
    const cursor = encodeOutstandingBalanceCursor({
      occurredAt: new Date(early.occurredAt),
      registrationId: early.registrationId,
    });
    const next = paginateOutstandingBalanceItems({
      items: [late, early],
      limit: 10,
      cursor,
    });
    assert.equal(next.items[0]?.registrationId, late.registrationId);
  });

  it("D1-G — boundary: invoice compile SoT; no gateway / mutation path", () => {
    const service = readFileSync(
      resolve(PKG_ROOT, "src/application/finance.service.ts"),
      "utf8"
    );
    const start = service.indexOf("async listOutstandingBalances");
    assert.ok(start > 0);
    const end = service.indexOf("async listPendingReceipts", start);
    const body = service.slice(start, end);
    assert.match(body, /loadOutstandingBalanceItems/);
    const outstandingModule = readFileSync(
      resolve(PKG_ROOT, "src/application/finance-outstanding-operator.ts"),
      "utf8"
    );
    assert.match(outstandingModule, /tryCompileRegistrationInvoiceInternal/);
    assert.match(service, /compileRegistrationInvoiceInternal/);
    assert.match(outstandingModule, /isPositiveBalanceDueMinor/);
    assert.match(outstandingModule, /listOutstandingBalanceCandidates/);
    assert.doesNotMatch(body, /SUM\(|sum\(.*payment|paidPaymentsMinor\s*\+/i);
    assert.doesNotMatch(body, /stripe|psp|gateway|capture|refund/i);
    assert.doesNotMatch(body, /createManualPayment|cancelPending|reviewReceipt|approveManual/);

    const doc = readFileSync(
      resolve(
        PKG_ROOT,
        "../../docs/phase-20/p7/appendices/FINANCE_OUTSTANDING_BALANCE_READ_MODEL_PR23_D1.md"
      ),
      "utf8"
    );
    assert.match(doc, /manual\/offline/i);
    assert.match(doc, /Online payment gateway/);
    assert.match(doc, /Invoice as AR SoT/);
  });
});
