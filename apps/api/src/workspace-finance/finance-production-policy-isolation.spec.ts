/**
 * Production finance honesty — Denali vs finance-ws5 in one process.
 * Different policy results; no cross-contamination of adapters / reaction state.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { FinanceWs5TourCreatedFinanceReactionAdapter } from "@app-tour/workspace-finance-ws5";
import { resolveFinanceWorkspaceDependencies } from "./finance-dependency-registry.ts";
import {
  resolveWorkspaceFinanceEventReaction,
} from "./finance-event-reaction-registry.ts";
import { resolveFinanceChartOfAccounts } from "./finance-chart-of-accounts-registry.ts";
import { isFinanceSupportedWorkspace } from "./workspace-finance-bindings.generated.ts";

const CAPTURE_INPUT = {
  tenantId: "00000000-0000-4000-8000-000000000014",
  paymentId: "00000000-0000-4000-8000-000000000501",
  registrationId: "00000000-0000-4000-8000-000000000502",
  amountMinor: "1000",
  currency: "USD",
  capturedAtIso: "2026-07-19T12:00:00.000Z",
};

describe("finance production policy isolation (denali vs finance-ws5)", () => {
  it("both are product-supported; demoted fixtures are not (capabilities differ — see B2.3 matrix)", () => {
    assert.equal(isFinanceSupportedWorkspace("denali"), true);
    assert.equal(isFinanceSupportedWorkspace("finance-ws5"), true);
    assert.equal(isFinanceSupportedWorkspace("finance-ws3"), false);
  });

  it("same process: receipt defaults differ; ledger accounts differ; no shared adapter identity", () => {
    const denali = resolveFinanceWorkspaceDependencies("denali");
    const ws5 = resolveFinanceWorkspaceDependencies("finance-ws5");

    assert.notEqual(denali.ledgerPolicy, ws5.ledgerPolicy);
    assert.notEqual(denali.receiptDefaults, ws5.receiptDefaults);

    const denaliDefaults = denali.receiptDefaults.offlineReceiptPaymentDefaults();
    const ws5Defaults = ws5.receiptDefaults.offlineReceiptPaymentDefaults();
    assert.equal(denaliDefaults.currency, "IRR");
    assert.equal(ws5Defaults.currency, "CAD");
    assert.notEqual(denaliDefaults.amountMinor, ws5Defaults.amountMinor);

    const denaliCoa = resolveFinanceChartOfAccounts("denali");
    const ws5Coa = resolveFinanceChartOfAccounts("finance-ws5");
    assert.equal(denaliCoa.REGISTRATION_LEADER_PAYMENT_CLEARING, "gl:leader-registration-payment-clearing");
    assert.equal(ws5Coa.OPERATOR_CASH_CLEARING, "ws5:gl:operator-cash-clearing");
    assert.notEqual(
      denaliCoa.REGISTRATION_LEADER_PAYMENT_CLEARING,
      ws5Coa.OPERATOR_CASH_CLEARING
    );

    const denaliPlan = denali.ledgerPolicy.buildPaymentCaptureJournal(CAPTURE_INPUT);
    const ws5Plan = ws5.ledgerPolicy.buildPaymentCaptureJournal(CAPTURE_INPUT);
    const denaliAccounts = new Set(denaliPlan.lines.map((l) => l.account));
    const ws5Accounts = new Set(ws5Plan.lines.map((l) => l.account));
    assert.ok([...denaliAccounts].some((a) => a.startsWith("gl:") || a.startsWith("booking:")));
    assert.ok([...ws5Accounts].some((a) => a.startsWith("ws5:")));
    assert.equal(
      [...denaliAccounts].some((a) => ws5Accounts.has(a)),
      false,
      "Denali and WS5 journal accounts must not overlap"
    );
  });

  it("TourCreated reaction: WS5 handles observably; state does not leak to Denali port", async () => {
    const ws5 = resolveWorkspaceFinanceEventReaction("finance-ws5");
    const denali = resolveWorkspaceFinanceEventReaction("denali");
    assert.ok(ws5 instanceof FinanceWs5TourCreatedFinanceReactionAdapter);

    const row = {
      tenantId: "00000000-0000-4000-8000-000000000014",
      domainEventId: "isolation-tour-1",
      eventType: "TourCreated" as const,
      aggregateType: "tour",
      aggregateId: "00000000-0000-4000-8000-000000000077",
      payload: { tenantId: "00000000-0000-4000-8000-000000000014" },
    };

    assert.equal(await ws5.reactToPublishedRow(row), true);
    assert.deepEqual(ws5.handledDomainEventIds, ["isolation-tour-1"]);

    // Denali requires finance payload side-effects; incomplete row stays unhandled.
    assert.equal(await denali.reactToPublishedRow(row), false);
    assert.ok(!("handledDomainEventIds" in denali));
  });
});
