/**
 * Finance B2.4 — shared infrastructure adversarial isolation.
 *
 * Architecture under test (intentional):
 * - FinanceService instances are isolated by workspaceType (policies diverge)
 * - InMemoryFinanceRepository + BookingPaymentAdapter are process-shared
 * - Tenant ownership is the persistence authority; workspaceType selects capability/policy only
 *
 * Does not split repositories or introduce per-workspace infrastructure.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, beforeEach, describe, it } from "node:test";

import {
  DenaliFinanceLedgerPolicyAdapter,
  DenaliFinanceReceiptDefaultsAdapter,
} from "@app-tour/workspace-denali";
import {
  FinanceWs5LedgerPolicyAdapter,
  FinanceWs5ReceiptDefaultsAdapter,
} from "@app-tour/workspace-finance-ws5";

import {
  getBookingsRepository,
  resetBookingsRepositoryForTests,
} from "../bookings/create-bookings-repository.ts";
import { FinanceService } from "./finance.service.ts";
import { BookingPaymentAdapter } from "./infrastructure/booking-payment.adapter.ts";
import { BookingRegistrationDisplayAdapter } from "./infrastructure/booking-registration-display.adapter.ts";
import {
  InMemoryFinanceRepository,
  resetInMemoryFinanceRepositoryForTests,
} from "./in-memory-finance.repository.ts";
import type { FinanceActorContext } from "./ports/finance-actor-context.ts";
import type { FinanceCapabilityPort } from "./ports/finance-capability.port.ts";
import type { FinanceRepositoryPort } from "./ports/finance-repository.port.ts";
import type { IBookingPaymentPort } from "./ports/booking-payment.port.ts";
import {
  fakeEmptySchedules,
  fakeFixedClock,
  fakeMemoryPersistenceMode,
  fakeNoopLog,
  fakeNoopMetrics,
  fakePermissiveAccess,
  fakeReceiptProofUrl,
} from "./finance-service-host-fakes.ts";
import {
  financeWorkspaceEventReactionCapability,
  getFinanceWorkspaceCapabilities,
} from "./workspace-finance-capabilities.generated.ts";

const TENANT_A = "00000000-0000-4000-8000-0000000000a1";
const TENANT_B = "00000000-0000-4000-8000-0000000000b2";
const DENALI = "denali";
const WS5 = "finance-ws5";

function authFor(tenantId: string): FinanceActorContext {
  return {
    userId: "00000000-0000-4000-8000-0000000000aa",
    tenantId,
    role: "admin",
    status: "ACTIVE",
    workspaceId: `ws-${tenantId.slice(-4)}`,
  };
}

function capabilityFor(workspaceType: string): FinanceCapabilityPort {
  return {
    async assertEnabled() {
      return { workspaceType, theme: {} };
    },
  };
}

function seedBooking(input: {
  readonly id: string;
  readonly tenantId: string;
  readonly paymentStatus?: "unpaid" | "paid" | "partial";
}): void {
  getBookingsRepository().seedBooking({
    id: input.id,
    tenantId: input.tenantId,
    tourId: "00000000-0000-4000-8000-0000000000t1",
    tourTitle: "B2.4 Isolation Tour",
    guestLabel: "Guest",
    guestEmail: null,
    guestPhone: null,
    partySize: 1,
    status: "pending",
    paymentStatus: input.paymentStatus ?? "unpaid",
    departureAt: "2026-08-01T00:00:00.000Z",
    submittedAt: "2026-07-01T00:00:00.000Z",
    submittedByUserId: "00000000-0000-4000-8000-0000000000m1",
    approvedAt: null,
  });
}

function createSharedPlatform(): {
  readonly bookingPayments: BookingPaymentAdapter;
  readonly repository: InMemoryFinanceRepository;
} {
  const bookingPayments = new BookingPaymentAdapter(getBookingsRepository());
  const repository = new InMemoryFinanceRepository(bookingPayments);
  return { bookingPayments, repository };
}

function createWorkspaceFinanceService(input: {
  readonly workspaceType: typeof DENALI | typeof WS5;
  readonly repository: FinanceRepositoryPort;
  readonly bookingPayments: IBookingPaymentPort;
}): FinanceService {
  const isDenali = input.workspaceType === DENALI;
  return new FinanceService(
    isDenali ? new DenaliFinanceLedgerPolicyAdapter() : new FinanceWs5LedgerPolicyAdapter(),
    input.repository,
    input.bookingPayments,
    isDenali
      ? new DenaliFinanceReceiptDefaultsAdapter()
      : new FinanceWs5ReceiptDefaultsAdapter(),
    new BookingRegistrationDisplayAdapter(),
    fakeNoopMetrics,
    fakeMemoryPersistenceMode,
    fakeReceiptProofUrl,
    capabilityFor(input.workspaceType),
    fakePermissiveAccess,
    fakeEmptySchedules,
    fakeNoopLog,
    fakeFixedClock
  );
}

async function seedPaymentReceiptLedger(input: {
  readonly finance: FinanceService;
  readonly repository: InMemoryFinanceRepository;
  readonly tenantId: string;
  readonly registrationId: string;
  readonly amount: string;
  readonly currency: string;
  readonly idempotencyKey: string;
}): Promise<{ readonly paymentId: string; readonly receiptId: string }> {
  const auth = authFor(input.tenantId);
  const payment = await input.finance.createManualPayment(
    auth,
    {
      registrationId: input.registrationId,
      amount: input.amount,
      currency: input.currency,
    },
    input.idempotencyKey
  );
  const receipt = await input.finance.submitReceipt(
    auth,
    {
      paymentId: payment.id,
      fileKey: `receipts/${payment.id}/b24.jpg`,
      note: "b24",
    },
    `${input.idempotencyKey}-receipt`
  );
  await input.repository.markPaymentPaid(
    input.tenantId,
    payment.id,
    `journal:${payment.id}`
  );
  return { paymentId: payment.id, receiptId: receipt.id };
}

describe("finance shared infrastructure safety (B2.4)", { concurrency: false }, () => {
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

  it("Scenario A: Tenant A/denali vs Tenant B/ws5 — no cross-tenant visibility; policies diverge", async () => {
    const { bookingPayments, repository } = createSharedPlatform();
    const denali = createWorkspaceFinanceService({
      workspaceType: DENALI,
      repository,
      bookingPayments,
    });
    const ws5 = createWorkspaceFinanceService({
      workspaceType: WS5,
      repository,
      bookingPayments,
    });

    const regA = randomUUID();
    const regB = randomUUID();
    seedBooking({ id: regA, tenantId: TENANT_A });
    seedBooking({ id: regB, tenantId: TENANT_B });

    const a = await seedPaymentReceiptLedger({
      finance: denali,
      repository,
      tenantId: TENANT_A,
      registrationId: regA,
      amount: "2500000",
      currency: "IRR",
      idempotencyKey: "b24-a-denali",
    });
    const b = await seedPaymentReceiptLedger({
      finance: ws5,
      repository,
      tenantId: TENANT_B,
      registrationId: regB,
      amount: "12500",
      currency: "CAD",
      idempotencyKey: "b24-b-ws5",
    });

    const authA = authFor(TENANT_A);
    const authB = authFor(TENANT_B);

    const paymentsA = await denali.listPayments(authA, 50);
    const paymentsB = await ws5.listPayments(authB, 50);
    assert.equal(paymentsA.length, 1);
    assert.equal(paymentsB.length, 1);
    assert.equal(paymentsA[0]!.id, a.paymentId);
    assert.equal(paymentsB[0]!.id, b.paymentId);
    assert.equal(
      paymentsA.some((p) => p.id === b.paymentId),
      false,
      "Tenant A must not see Tenant B payment"
    );
    assert.equal(
      paymentsB.some((p) => p.id === a.paymentId),
      false,
      "Tenant B must not see Tenant A payment"
    );

    assert.equal(await repository.findPaymentById(TENANT_A, b.paymentId), null);
    assert.equal(await repository.findPaymentById(TENANT_B, a.paymentId), null);
    assert.equal(await repository.findReceiptById(TENANT_A, b.receiptId), null);
    assert.equal(await repository.findReceiptById(TENANT_B, a.receiptId), null);

    // Service listLedgerEvents maps rows (no payload); assert tenant filter on shared repo.
    const ledgerA = await repository.listLedgerEvents(TENANT_A, 50);
    const ledgerB = await repository.listLedgerEvents(TENANT_B, 50);
    assert.equal(ledgerA.length, 1);
    assert.equal(ledgerB.length, 1);
    assert.equal(ledgerA[0]!.domainEventId, `payment:${a.paymentId}:ledger-capture-anchor`);
    assert.equal(ledgerB[0]!.domainEventId, `payment:${b.paymentId}:ledger-capture-anchor`);
    assert.equal(
      ledgerA.some((e) => e.domainEventId === `payment:${b.paymentId}:ledger-capture-anchor`),
      false
    );
    assert.equal(
      ledgerB.some((e) => e.domainEventId === `payment:${a.paymentId}:ledger-capture-anchor`),
      false
    );

    // FinanceService path also stays tenant-scoped (mapped rows carry domainEventId).
    const serviceLedgerA = await denali.listLedgerEvents(authA, 50);
    const serviceLedgerB = await ws5.listLedgerEvents(authB, 50);
    assert.equal(serviceLedgerA.length, 1);
    assert.equal(serviceLedgerB.length, 1);
    assert.equal(serviceLedgerA[0]!.domainEventId, `payment:${a.paymentId}:ledger-capture-anchor`);
    assert.equal(serviceLedgerB[0]!.domainEventId, `payment:${b.paymentId}:ledger-capture-anchor`);

    // Capability / policy isolation (same process, shared repo).
    assert.equal(getFinanceWorkspaceCapabilities(DENALI)?.eventReactions, "durable-outbox");
    assert.equal(financeWorkspaceEventReactionCapability(WS5), "ack-only");
    assert.deepEqual(
      new DenaliFinanceReceiptDefaultsAdapter().offlineReceiptPaymentDefaults(),
      { amountMinor: "2500000", currency: "IRR" }
    );
    assert.deepEqual(
      new FinanceWs5ReceiptDefaultsAdapter().offlineReceiptPaymentDefaults(),
      { amountMinor: "12500", currency: "CAD" }
    );
    const denaliPlan = new DenaliFinanceLedgerPolicyAdapter().buildPaymentCaptureJournal({
      tenantId: TENANT_A,
      paymentId: a.paymentId,
      registrationId: regA,
      amountMinor: "2500000",
      currency: "IRR",
      capturedAtIso: "2026-07-19T12:00:00.000Z",
    });
    const ws5Plan = new FinanceWs5LedgerPolicyAdapter().buildPaymentCaptureJournal({
      tenantId: TENANT_B,
      paymentId: b.paymentId,
      registrationId: regB,
      amountMinor: "12500",
      currency: "CAD",
      capturedAtIso: "2026-07-19T12:00:00.000Z",
    });
    const denaliAccounts = new Set(denaliPlan.lines.map((l) => l.account));
    const ws5Accounts = new Set(ws5Plan.lines.map((l) => l.account));
    assert.equal(
      [...denaliAccounts].some((account) => ws5Accounts.has(account)),
      false,
      "Denali and WS5 CoA accounts must not overlap"
    );

    // Shared booking adapter: wrong-tenant lookup/update is a miss.
    assert.equal(
      await bookingPayments.getPaymentStatus({ tenantId: TENANT_A, registrationId: regB }),
      null
    );
    assert.equal(
      await bookingPayments.syncStatus({
        tenantId: TENANT_A,
        registrationId: regB,
        paymentStatus: "paid",
      }),
      null
    );
    const bookingB = await getBookingsRepository().getById(regB, TENANT_B);
    assert.equal(bookingB?.paymentStatus, "unpaid");
    assert.equal(
      await bookingPayments.syncStatus({
        tenantId: TENANT_B,
        registrationId: regB,
        paymentStatus: "paid",
      }),
      "paid"
    );
  });

  it("Scenario B: same tenant, different workspaceType — tenant owns data; workspaceType selects policy only", async () => {
    const { bookingPayments, repository } = createSharedPlatform();
    const denali = createWorkspaceFinanceService({
      workspaceType: DENALI,
      repository,
      bookingPayments,
    });
    const ws5 = createWorkspaceFinanceService({
      workspaceType: WS5,
      repository,
      bookingPayments,
    });

    const registrationId = randomUUID();
    seedBooking({ id: registrationId, tenantId: TENANT_A });

    const created = await seedPaymentReceiptLedger({
      finance: denali,
      repository,
      tenantId: TENANT_A,
      registrationId,
      amount: "2500000",
      currency: "IRR",
      idempotencyKey: "b24-same-tenant",
    });

    // Shared repo: WS5 service sees the same tenant-owned rows (not workspace-owned).
    const viaWs5 = await ws5.listPayments(authFor(TENANT_A), 50);
    assert.equal(viaWs5.length, 1);
    assert.equal(viaWs5[0]!.id, created.paymentId);

    const receipt = await repository.findReceiptById(TENANT_A, created.receiptId);
    assert.ok(receipt);
    assert.equal(
      Object.prototype.hasOwnProperty.call(receipt, "workspaceType"),
      false,
      "receipt rows must not store workspaceType"
    );
    const payment = await repository.findPaymentById(TENANT_A, created.paymentId);
    assert.ok(payment);
    assert.equal(
      Object.prototype.hasOwnProperty.call(payment, "workspaceType"),
      false,
      "payment rows must not store workspaceType"
    );

    // WorkspaceType only affects capability/policy selection, not row ownership.
    assert.notEqual(
      new DenaliFinanceLedgerPolicyAdapter().buildPaymentCaptureJournal({
        tenantId: TENANT_A,
        paymentId: created.paymentId,
        registrationId,
        amountMinor: "2500000",
        currency: "IRR",
        capturedAtIso: "2026-07-19T12:00:00.000Z",
      }).lines[0]!.account,
      new FinanceWs5LedgerPolicyAdapter().buildPaymentCaptureJournal({
        tenantId: TENANT_A,
        paymentId: created.paymentId,
        registrationId,
        amountMinor: "2500000",
        currency: "IRR",
        capturedAtIso: "2026-07-19T12:00:00.000Z",
      }).lines[0]!.account
    );
  });

  it("Scenario C: reverse creation order — first-created workspace does not own shared infra", async () => {
    async function run(order: readonly [typeof DENALI | typeof WS5, typeof DENALI | typeof WS5]) {
      resetInMemoryFinanceRepositoryForTests();
      resetBookingsRepositoryForTests();
      const { bookingPayments, repository } = createSharedPlatform();
      const first = createWorkspaceFinanceService({
        workspaceType: order[0],
        repository,
        bookingPayments,
      });
      const second = createWorkspaceFinanceService({
        workspaceType: order[1],
        repository,
        bookingPayments,
      });
      assert.notEqual(first, second);

      const regA = randomUUID();
      const regB = randomUUID();
      seedBooking({ id: regA, tenantId: TENANT_A });
      seedBooking({ id: regB, tenantId: TENANT_B });

      const denaliService = order[0] === DENALI ? first : second;
      const ws5Service = order[0] === WS5 ? first : second;

      await seedPaymentReceiptLedger({
        finance: denaliService,
        repository,
        tenantId: TENANT_A,
        registrationId: regA,
        amount: "2500000",
        currency: "IRR",
        idempotencyKey: `b24-order-${order.join("-")}-a`,
      });
      await seedPaymentReceiptLedger({
        finance: ws5Service,
        repository,
        tenantId: TENANT_B,
        registrationId: regB,
        amount: "12500",
        currency: "CAD",
        idempotencyKey: `b24-order-${order.join("-")}-b`,
      });

      // Memory HTTP summary is empty by design; assert on shared repo (tenant authority).
      const summaryA = await repository.getSummary(TENANT_A);
      const summaryB = await repository.getSummary(TENANT_B);
      assert.equal(summaryA.paidPayments, 1);
      assert.equal(summaryB.paidPayments, 1);
      assert.equal(summaryA.pendingManualPayments, 0);
      assert.equal(summaryB.pendingManualPayments, 0);

      // Either workspace service can read the same tenant-owned rows (shared repo).
      assert.equal((await denaliService.listPayments(authFor(TENANT_B), 50)).length, 1);
      assert.equal((await ws5Service.listPayments(authFor(TENANT_A), 50)).length, 1);
      assert.equal((await repository.listPayments(TENANT_A, 50)).length, 1);
      assert.equal((await repository.listPayments(TENANT_B, 50)).length, 1);
      assert.equal((await repository.listLedgerEvents(TENANT_A, 50)).length, 1);
      assert.equal((await repository.listLedgerEvents(TENANT_B, 50)).length, 1);

      return {
        bookingPayments,
        repository,
        denaliDefaults: new DenaliFinanceReceiptDefaultsAdapter().offlineReceiptPaymentDefaults(),
        ws5Defaults: new FinanceWs5ReceiptDefaultsAdapter().offlineReceiptPaymentDefaults(),
      };
    }

    const forward = await run([DENALI, WS5]);
    const reverse = await run([WS5, DENALI]);
    assert.deepEqual(forward.denaliDefaults, reverse.denaliDefaults);
    assert.deepEqual(forward.ws5Defaults, reverse.ws5Defaults);
    assert.notEqual(forward.bookingPayments, reverse.bookingPayments);
  });

  it("BookingPaymentAdapter: tenant boundary on lookup/update; no cross-tenant mutation", async () => {
    const bookingPayments = new BookingPaymentAdapter(getBookingsRepository());
    const reg = randomUUID();
    seedBooking({ id: reg, tenantId: TENANT_A, paymentStatus: "unpaid" });

    assert.equal(
      await bookingPayments.getPaymentStatus({ tenantId: TENANT_B, registrationId: reg }),
      null
    );
    assert.equal(
      await bookingPayments.memberOwnsRegistration({
        tenantId: TENANT_B,
        registrationId: reg,
        userId: "00000000-0000-4000-8000-0000000000m1",
      }),
      false
    );
    assert.equal(
      await bookingPayments.syncStatus({
        tenantId: TENANT_B,
        registrationId: reg,
        paymentStatus: "paid",
      }),
      null
    );
    assert.equal(
      (await getBookingsRepository().getById(reg, TENANT_A))?.paymentStatus,
      "unpaid"
    );
    assert.equal(
      await bookingPayments.syncStatus({
        tenantId: TENANT_A,
        registrationId: reg,
        paymentStatus: "paid",
      }),
      "paid"
    );
  });
});
