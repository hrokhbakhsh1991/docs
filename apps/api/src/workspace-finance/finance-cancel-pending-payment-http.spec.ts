/**
 * PR23-A3 — HTTP boundary for cancelPendingManualPayment.
 * Transport only; FinanceService owns cancellation semantics.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { after, beforeEach, describe, it } from "node:test";

import type { TenantAuthContext } from "@app-tour/workspace-sdk";
import {
  configureFinanceHttpHost,
  handleFinanceCancelPendingManualPayment,
  resetFinanceHttpHostForTests,
} from "@app-tour/finance-http";
import { createFinanceService } from "@app-tour/finance-core";
import type { FinanceObligationPort } from "@app-tour/finance-http-contracts";

import { handleHttpError } from "../middleware/error-interceptor.ts";
import { runWithTraceContext } from "../observability/trace-request-context.ts";
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
import type { IBookingPaymentPort } from "./ports/booking-payment.port.ts";
import type { RegistrationDisplayPort } from "./ports/registration-display.port.ts";
import type { FinanceLedgerPolicyPort } from "./ports/finance-ledger-policy.port.ts";
import type { FinanceReceiptDefaultsPort } from "./ports/finance-receipt-defaults.port.ts";

const TENANT = "00000000-0000-4000-8000-000000000099";
const TENANT_B = "00000000-0000-4000-8000-000000000098";

const AUTH: TenantAuthContext = {
  userId: "00000000-0000-4000-8000-000000000001",
  tenantId: TENANT,
  role: "admin",
  status: "ACTIVE",
  workspaceId: "ws-cancel-http",
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

function createFakeBookingPort(): IBookingPaymentPort & {
  readonly paidRegistrations: Set<string>;
} {
  const paidRegistrations = new Set<string>();
  return {
    paidRegistrations,
    async syncStatus(input) {
      if (input.paymentStatus === "paid") {
        paidRegistrations.add(input.registrationId);
      }
      return input.paymentStatus;
    },
    async raisePaidInTx(_tx, input) {
      if (input.paymentStatus === "paid" || input.paymentStatus === "partial") {
        paidRegistrations.add(input.registrationId);
      }
      return input.paymentStatus;
    },
    async memberOwnsRegistration() {
      return true;
    },
    async getPaymentStatus(input) {
      return paidRegistrations.has(input.registrationId) ? "paid" : "unpaid";
    },
    async getRegistrationLifecycleStatus() {
      return "approved";
    },
  };
}

const fakeLedger: FinanceLedgerPolicyPort = {
  buildPaymentCaptureJournal: (input) => ({
    journalId: `journal:${input.paymentId}`,
    domainEventId: `payment:${input.paymentId}:ledger-capture-anchor`,
    lines: [
      {
        id: `line:${input.paymentId}:dr`,
        journalId: `journal:${input.paymentId}`,
        tenantId: input.tenantId,
        account: "cash",
        side: "debit",
        amount_minor: input.amountMinor,
        currency: input.currency,
        correlationId: input.registrationId,
        idempotencyKey: `payment:${input.paymentId}:ledger-capture-anchor`,
        createdAt: input.capturedAtIso,
      },
      {
        id: `line:${input.paymentId}:cr`,
        journalId: `journal:${input.paymentId}`,
        tenantId: input.tenantId,
        account: "liability",
        side: "credit",
        amount_minor: input.amountMinor,
        currency: input.currency,
        correlationId: input.registrationId,
        idempotencyKey: `payment:${input.paymentId}:ledger-capture-anchor:cr`,
        createdAt: input.capturedAtIso,
      },
    ],
  }),
  buildPrepaymentJournal: (input) => ({
    journalId: `journal:prepay:${input.journalSeed}`,
    domainEventId: input.ledgerDomainEventId,
    lines: [],
  }),
};

const fakeReceiptDefaults: FinanceReceiptDefaultsPort = {
  offlineReceiptPaymentDefaults: () => ({ amountMinor: "1000000", currency: "IRR" }),
};

const fakeDisplay: RegistrationDisplayPort = {
  async getByRegistrationIds() {
    return new Map();
  },
  async listRegistrationIdsByTourId() {
    return [];
  },
};

function createMockRes(): ServerResponse & { statusCode: number; body: string } {
  return {
    statusCode: 0,
    body: "",
    writableEnded: false,
    setHeader() {},
    end(payload?: string) {
      if (payload !== undefined) {
        this.body = payload;
      }
      this.writableEnded = true;
    },
  } as unknown as ServerResponse & { statusCode: number; body: string };
}

type HostState = {
  idempotencyKey?: string;
  body: unknown;
  rawBody: string;
  auth: TenantAuthContext;
  store: Map<string, Record<string, unknown>>;
};

describe("PR23-A3 finance cancel pending payment HTTP", { concurrency: false }, () => {
  let repo: InMemoryFinanceRepository;
  let finance: ReturnType<typeof createFinanceService>;
  let booking: ReturnType<typeof createFakeBookingPort>;
  let hostState: HostState;

  after(() => {
    resetFinanceHttpHostForTests();
  });

  beforeEach(() => {
    resetInMemoryFinanceRepositoryForTests();
    resetFinanceHttpHostForTests();

    booking = createFakeBookingPort();
    repo = new InMemoryFinanceRepository(booking);
    finance = createFinanceService(
      fakeLedger,
      repo,
      booking,
      fakeReceiptDefaults,
      fakeDisplay,
      fakeNoopMetrics,
      fakeMemoryPersistenceMode,
      fakeReceiptProofUrl,
      fakePermissiveCapability,
      fakePermissiveAccess,
      fakeEmptySchedules,
      fakeNoopLog,
      fakeFixedClock,
      offlineObligation()
    );

    hostState = {
      body: { reasonCode: "abandoned" },
      rawBody: JSON.stringify({ reasonCode: "abandoned" }),
      auth: AUTH,
      store: new Map(),
    };

    configureFinanceHttpHost({
      runWithHttpRequestContext: async (_req, _auth, fn) => fn(),
      sendJson: (res, status, body) => {
        (res as ServerResponse & { statusCode: number }).statusCode = status;
        (res as ServerResponse & { body: string }).body = JSON.stringify(body);
        (res as ServerResponse & { writableEnded: boolean }).writableEnded = true;
      },
      handleHttpError: (res, error) => {
        void runWithTraceContext("cancel-http-trace", () => {
          handleHttpError(res, error);
        });
      },
      resolveTenantContextFromRequest: async () => hostState.auth,
      readFinanceRequestBody: async () => ({
        parsedBody: hostState.body,
        rawBody: hostState.rawBody,
      }),
      resolveFinanceService: async () => finance,
      readIdempotencyKey: () => hostState.idempotencyKey,
      hashIdempotentRequest: (_method, path, rawBody) => `${path}:${rawBody}`,
      runIdempotentHttpMutation: async (tenantId, key, requestHash, execute) => {
        const mapKey = `${tenantId}:${key}`;
        const existing = hostState.store.get(mapKey);
        if (existing !== undefined) {
          if (existing.__hash !== requestHash) {
            throw new Error("IDEMPOTENCY_PAYLOAD_MISMATCH");
          }
          const { __hash: _drop, ...body } = existing;
          return body as Awaited<ReturnType<typeof execute>>;
        }
        const created = await execute();
        hostState.store.set(mapKey, { ...created, __hash: requestHash });
        return created;
      },
      idempotencyKeyRequiredCode: "IDEMPOTENCY_KEY_REQUIRED",
      uploadOperatorReceiptProof: async () => ({ fileKey: "x" }),
      enqueueScheduleItemWaivedAudit: async () => {},
      loadFinanceCaseEncounter: async () => {
        throw new Error("not-used");
      },
      runFinanceCaseCommandReviewReceipt: async () => {
        throw new Error("not-used");
      },
    });
  });

  async function callCancel(
    paymentId: string
  ): Promise<ServerResponse & { statusCode: number; body: string }> {
    const res = createMockRes();
    const req = {} as IncomingMessage;
    await handleFinanceCancelPendingManualPayment(req, res, { financeService: finance }, paymentId);
    return res;
  }

  it("A — Manual Pending cancel succeeds", async () => {
    const payment = await repo.createManualPayment({
      tenantId: TENANT,
      registrationId: randomUUID(),
      amount: "1000000",
      currency: "IRR",
      method: "Manual",
      provider: "manual",
      status: "Pending",
    });
    hostState.idempotencyKey = "cancel-a-1";

    const res = await callCancel(payment.id);
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body) as {
      paymentId: string;
      status: string;
      cancellationEventId: string;
      occurredAt: string;
      reasonCode: string;
      replay: boolean;
    };
    assert.equal(body.paymentId, payment.id);
    assert.equal(body.status, "Cancelled");
    assert.equal(body.cancellationEventId, `payment-cancelled:${payment.id}`);
    assert.equal(body.occurredAt, "2026-01-15T12:00:00.000Z");
    assert.equal(body.reasonCode, "abandoned");
    assert.equal(body.replay, false);
    assert.equal((await repo.findPaymentById(TENANT, payment.id))?.status, "Cancelled");
  });

  it("B — Cancelled releases debt gate for new manual payment", async () => {
    const registrationId = randomUUID();
    const first = await finance.createManualPayment(
      AUTH,
      { registrationId, amount: "1000000", currency: "IRR" },
      "create-b-1"
    );
    hostState.idempotencyKey = "cancel-b-1";
    const res = await callCancel(first.id);
    assert.equal(res.statusCode, 200);

    const second = await finance.createManualPayment(
      AUTH,
      { registrationId, amount: "500000", currency: "IRR" },
      "create-b-2"
    );
    assert.equal(second.status, "Pending");
    assert.notEqual(second.id, first.id);
  });

  it("C — Pending receipt blocks cancel", async () => {
    const payment = await repo.createManualPayment({
      tenantId: TENANT,
      registrationId: randomUUID(),
      amount: "1000",
      currency: "IRR",
      method: "Manual",
      provider: "manual",
      status: "Pending",
    });
    await repo.createReceipt({
      tenantId: TENANT,
      paymentId: payment.id,
      fileKey: `receipts/${payment.id}/x.jpg`,
    });
    hostState.idempotencyKey = "cancel-c-1";

    const res = await callCancel(payment.id);
    assert.equal(res.statusCode, 409);
    const body = JSON.parse(res.body) as { code?: string };
    assert.equal(body.code, "PAYMENT_HAS_PENDING_RECEIPT");
  });

  it("D — Paid payment cannot cancel", async () => {
    const payment = await repo.createManualPayment({
      tenantId: TENANT,
      registrationId: randomUUID(),
      amount: "1000",
      currency: "IRR",
      method: "Manual",
      provider: "manual",
      status: "Pending",
    });
    await repo.markPaymentPaid(TENANT, payment.id, randomUUID());
    hostState.idempotencyKey = "cancel-d-1";

    const res = await callCancel(payment.id);
    assert.equal(res.statusCode, 409);
    const body = JSON.parse(res.body) as { code?: string };
    assert.equal(body.code, "PAYMENT_NOT_CANCELLABLE");
  });

  it("E — Non-manual payment cannot cancel", async () => {
    const payment = await repo.createManualPayment({
      tenantId: TENANT,
      registrationId: randomUUID(),
      amount: "1000",
      currency: "IRR",
      method: "Online",
      provider: "stripe",
      status: "Pending",
    });
    hostState.idempotencyKey = "cancel-e-1";

    const res = await callCancel(payment.id);
    assert.equal(res.statusCode, 409);
    const body = JSON.parse(res.body) as { code?: string };
    assert.equal(body.code, "PAYMENT_CANCEL_ONLY_MANUAL");
  });

  it("F — Invalid reason validation", async () => {
    const payment = await repo.createManualPayment({
      tenantId: TENANT,
      registrationId: randomUUID(),
      amount: "1000",
      currency: "IRR",
      method: "Manual",
      provider: "manual",
      status: "Pending",
    });
    hostState.idempotencyKey = "cancel-f-1";
    hostState.body = { reasonCode: "not-a-reason" };
    hostState.rawBody = JSON.stringify(hostState.body);

    const res = await callCancel(payment.id);
    assert.equal(res.statusCode, 400);
    const body = JSON.parse(res.body) as { code?: string };
    assert.equal(body.code, "ZOD_VALIDATION_FAILED");
  });

  it("G — Cross-tenant payment does not leak existence", async () => {
    const payment = await repo.createManualPayment({
      tenantId: TENANT_B,
      registrationId: randomUUID(),
      amount: "1000",
      currency: "IRR",
      method: "Manual",
      provider: "manual",
      status: "Pending",
    });
    hostState.idempotencyKey = "cancel-g-1";

    const res = await callCancel(payment.id);
    assert.equal(res.statusCode, 404);
    const body = JSON.parse(res.body) as { code?: string; error?: string };
    assert.equal(body.code, "PAYMENT_NOT_FOUND");
    assert.equal(body.error, "PAYMENT_NOT_FOUND");
    assert.equal(res.body.includes("NOT_IN_SCOPE"), false);
  });

  it("H — Idempotent replay returns same result", async () => {
    const payment = await repo.createManualPayment({
      tenantId: TENANT,
      registrationId: randomUUID(),
      amount: "1000",
      currency: "IRR",
      method: "Manual",
      provider: "manual",
      status: "Pending",
    });
    hostState.idempotencyKey = "cancel-h-same";

    const first = await callCancel(payment.id);
    const second = await callCancel(payment.id);
    assert.equal(first.statusCode, 200);
    assert.equal(second.statusCode, 200);
    assert.equal(first.body, second.body);
  });

  it("I — No failedPayments increment", async () => {
    const payment = await repo.createManualPayment({
      tenantId: TENANT,
      registrationId: randomUUID(),
      amount: "1000",
      currency: "IRR",
      method: "Manual",
      provider: "manual",
      status: "Pending",
    });
    hostState.idempotencyKey = "cancel-i-1";
    await callCancel(payment.id);

    const summary = await repo.getSummary(TENANT);
    assert.equal(summary.failedPayments, 0);
    assert.equal(summary.cancelledPayments, 1);
  });

  it("J — No ledger/booking mutation", async () => {
    const registrationId = randomUUID();
    const payment = await repo.createManualPayment({
      tenantId: TENANT,
      registrationId,
      amount: "1000",
      currency: "IRR",
      method: "Manual",
      provider: "manual",
      status: "Pending",
    });
    hostState.idempotencyKey = "cancel-j-1";
    await callCancel(payment.id);

    const ledger = await repo.listLedgerEvents(TENANT, 50);
    assert.equal(
      ledger.filter((e) => e.eventType.startsWith("finance.ledger.")).length,
      0
    );
    assert.ok(ledger.some((e) => e.eventType === "finance.payment.cancelled"));

    const bookingStatus = await booking.getPaymentStatus({
      tenantId: TENANT,
      registrationId,
    });
    assert.equal(bookingStatus, "unpaid");
  });
});
