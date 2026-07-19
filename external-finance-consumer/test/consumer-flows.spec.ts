/**
 * Phase 2.3.4 — true external consumer simulation.
 * Proves finance-core can be composed outside the monorepo host.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, it } from "node:test";

import type { FinanceActorContext } from "@app-tour/finance-core";

import {
  createExternalFinanceApp,
  resetExternalFinanceRepository,
} from "../src/compose";

/** Fixture root — tests run via `pnpm test` from external-finance-consumer/. */
const ROOT = process.cwd();
const TENANT = "00000000-0000-4000-8000-000000000099";
const AUTH: FinanceActorContext = {
  userId: "00000000-0000-4000-8000-000000000001",
  tenantId: TENANT,
  role: "admin",
  status: "ACTIVE",
  workspaceId: "ws-external-consumer",
};

function walkTs(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === "node_modules") continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walkTs(p));
    else if (name.endsWith(".ts")) out.push(p);
  }
  return out;
}

describe("external-finance-consumer — second-repo simulation", () => {
  beforeEach(() => {
    resetExternalFinanceRepository();
  });

  it("import boundary — only finance-core (+ contracts via package graph)", () => {
    for (const file of walkTs(join(ROOT, "src")).concat(walkTs(join(ROOT, "test")))) {
      const src = readFileSync(file, "utf8");
      assert.doesNotMatch(src, /from\s+["'][^"']*apps\/api/);
      assert.doesNotMatch(src, /from\s+["']@apps\/api/);
      assert.doesNotMatch(src, /from\s+["']@app-tour\/workspace-/);
      assert.doesNotMatch(src, /from\s+["'][^"']*packages\/workspaces/);
      assert.doesNotMatch(src, /from\s+["']@prisma\/client["']/);
      assert.doesNotMatch(src, /from\s+["'][^"']*finance-core\/src/);
      assert.doesNotMatch(src, /from\s+["'][^"']*\/generated/);
    }
  });

  it("1) create payment", async () => {
    const { finance, repository } = createExternalFinanceApp();
    const registrationId = randomUUID();
    const payment = await finance.createManualPayment(
      AUTH,
      { registrationId, amount: "2500000", currency: "IRR" },
      "idem-pay-create-1"
    );
    assert.equal(payment.status, "Pending");
    assert.equal(payment.registrationId, registrationId);
    const found = await repository.findPaymentById(TENANT, payment.id);
    assert.equal(found?.id, payment.id);
  });

  it("2) create prepayment", async () => {
    const { finance, ledger } = createExternalFinanceApp();
    const registrationId = randomUUID();
    const recorded = await finance.recordPrepayment(
      AUTH,
      {
        registrationId,
        amountMinor: "500000",
        currency: "IRR",
        method: "Manual",
      },
      "idem-prepay-1"
    );
    assert.equal(recorded.registrationId, registrationId);
    assert.equal(recorded.amountMinor, "500000");
    assert.equal(ledger.prepaymentCaptures.length, 1);
    const listed = await finance.listPrepayments(AUTH, 10, registrationId);
    assert.equal(listed.length, 1);
  });

  it("3) approve payment + ledger capture", async () => {
    const { finance, repository, ledger, booking } = createExternalFinanceApp();
    const registrationId = randomUUID();
    const payment = await repository.createManualPayment({
      tenantId: TENANT,
      registrationId,
      amount: "2500000",
      currency: "IRR",
      method: "Manual",
      provider: "manual",
      status: "Pending",
    });
    const receipt = await repository.createReceipt({
      tenantId: TENANT,
      paymentId: payment.id,
      fileKey: `receipts/${payment.id}/proof.jpg`,
    });

    const reviewed = await finance.reviewReceipt(AUTH, receipt.id, {
      decision: "approve",
      reviewNote: "ok",
    });

    assert.equal(reviewed.status, "Approved");
    assert.ok("bookingPaymentStatus" in reviewed);
    assert.equal(reviewed.bookingPaymentStatus, "paid");
    assert.ok(booking.paidRegistrations.has(registrationId));
    assert.equal(ledger.paymentCaptures.length, 1);
    assert.equal(ledger.paymentCaptures[0]?.paymentId, payment.id);

    const events = await repository.listLedgerEvents(TENANT, 20);
    const capture = events.find((e) => e.eventType === "finance.ledger.capture");
    assert.ok(capture, "expected finance.ledger.capture");
    assert.equal(capture.domainEventId, `payment:${payment.id}:ledger-capture-anchor`);

    const paid = await repository.findPaymentById(TENANT, payment.id);
    assert.equal(paid?.status, "Paid");
  });

  it("4) idempotency — payment + prepayment key replay", async () => {
    const { finance, ledger } = createExternalFinanceApp();
    const registrationId = randomUUID();
    const first = await finance.createManualPayment(
      AUTH,
      { registrationId, amount: "1000", currency: "IRR" },
      "Idem-Pay-Key-A"
    );
    const second = await finance.createManualPayment(
      AUTH,
      { registrationId, amount: "1000", currency: "IRR" },
      "Idem-Pay-Key-A"
    );
    assert.equal(first.id, second.id);

    const prepay1 = await finance.recordPrepayment(
      AUTH,
      { registrationId, amountMinor: "100", currency: "IRR", method: "Manual" },
      "idem-prepay-same"
    );
    const prepay2 = await finance.recordPrepayment(
      AUTH,
      { registrationId, amountMinor: "100", currency: "IRR", method: "Manual" },
      "idem-prepay-same"
    );
    assert.equal(prepay1.id, prepay2.id);
    assert.equal(ledger.prepaymentCaptures.length, 2);
  });

  it("5) approve idempotent replay", async () => {
    const { finance, repository } = createExternalFinanceApp();
    const registrationId = randomUUID();
    const payment = await repository.createManualPayment({
      tenantId: TENANT,
      registrationId,
      amount: "2500000",
      currency: "IRR",
      method: "Manual",
      provider: "manual",
      status: "Pending",
    });
    const receipt = await repository.createReceipt({
      tenantId: TENANT,
      paymentId: payment.id,
      fileKey: `receipts/${payment.id}/proof.jpg`,
    });
    const reviewed = await finance.reviewReceipt(AUTH, receipt.id, {
      decision: "approve",
    });
    assert.equal(reviewed.status, "Approved");
    const replay = await finance.reviewReceipt(AUTH, receipt.id, {
      decision: "approve",
    });
    assert.equal(replay.status, "Approved");
  });
});
