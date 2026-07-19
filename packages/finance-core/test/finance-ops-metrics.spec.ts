/**
 * Phase 3.7 — finance ops metric emission on money paths.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { beforeEach, describe, it } from "node:test";

import { createFinanceService, FINANCE_METRIC } from "../src/index.ts";
import type { FinanceActorContext } from "../src/ports/finance-actor-context.ts";
import type { FinanceMetricsPort } from "../src/ports/finance-metrics.port.ts";
import {
  FakeAuthz,
  FakeCapability,
  FakeClock,
  FakeDisplay,
  FakeLogger,
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

const TENANT = "00000000-0000-4000-8000-000000000088";
const AUTH: FinanceActorContext = {
  userId: "00000000-0000-4000-8000-000000000001",
  tenantId: TENANT,
  role: "admin",
  status: "ACTIVE",
};

function createRecordingMetrics(): FinanceMetricsPort & {
  readonly calls: Array<{ name: string; labels?: Readonly<Record<string, string>> }>;
} {
  const calls: Array<{ name: string; labels?: Readonly<Record<string, string>> }> = [];
  return {
    calls,
    increment(name, labels) {
      calls.push({ name, ...(labels !== undefined ? { labels } : {}) });
    },
  };
}

describe("FIN-P3.7 finance ops metrics", () => {
  beforeEach(() => {
    resetInMemoryFinanceRepositoryForTests();
  });

  it("emits payment_created and receipt_submitted with tenant + workspace_type", async () => {
    const metrics = createRecordingMetrics();
    const booking = createFakeBookingPort();
    const repo = new InMemoryFinanceRepository(booking);
    const service = createFinanceService(
      createFakeLedgerPolicy(),
      repo,
      booking,
      FakeReceiptDefaults,
      FakeDisplay,
      metrics,
      FakeStorage,
      FakeProof,
      FakeCapability,
      FakeAuthz,
      FakeSchedules,
      FakeLogger,
      FakeClock
    );

    const payment = await service.createManualPayment(
      AUTH,
      {
        registrationId: randomUUID(),
        amount: "1000",
        currency: "IRR",
      },
      "idem-pay-metrics-1"
    );
    await service.submitReceipt(
      AUTH,
      { paymentId: payment.id, fileKey: `receipts/${TENANT}/x.pdf` },
      "idem-rcpt-metrics-1"
    );

    assert.ok(
      metrics.calls.some(
        (c) =>
          c.name === FINANCE_METRIC.paymentCreated &&
          c.labels?.tenant_id === TENANT &&
          c.labels?.workspace_type === "isolation"
      )
    );
    assert.ok(
      metrics.calls.some(
        (c) =>
          c.name === FINANCE_METRIC.receiptSubmitted &&
          c.labels?.tenant_id === TENANT &&
          c.labels?.workspace_type === "isolation"
      )
    );
  });
});
