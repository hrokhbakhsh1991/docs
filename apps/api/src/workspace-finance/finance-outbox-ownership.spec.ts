/**
 * Phase 1.7 / 1.8 / 1.9 / 1.10 — finance host TourCreated reaction + capability ownership.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import {
  isWorkspaceFinanceEventReactionRegistered,
  resolveWorkspaceFinanceEventReaction,
} from "./finance-event-reaction-registry";
import {
  isFinanceChartOfAccountsRegistered,
  resolveFinanceChartOfAccounts,
} from "./finance-chart-of-accounts-registry";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../");
const PROCESS = "apps/api/src/workspace-finance/process-workspace-finance-outbox.ts";
const READER = "apps/api/src/workspace-finance/prisma-workspace-outbox-reader.ts";
const ADAPTER =
  "packages/workspaces/denali/src/finance/adapters/denali-tour-created-finance-reaction.adapter.ts";
const INFRA = "apps/api/src/workspace-finance/infrastructure";
const DISPATCHER = "apps/api/src/workspace/workspace-tour-created-dispatcher.ts";
const GENERATED = "apps/api/src/workspace/workspace-outbox-side-effects.generated.ts";
const DEPENDENCY_REGISTRY = "apps/api/src/workspace-finance/finance-dependency-registry.ts";
const REACTION_REGISTRY = "apps/api/src/workspace-finance/finance-event-reaction-registry.ts";

describe("finance-outbox-ownership.spec.ts — Phase 1.7 / 1.8 / 1.9 / 1.10", () => {
  it("FIN-P1.7-C1-01 process module does not create Denali consumer", () => {
    const src = readFileSync(resolve(REPO_ROOT, PROCESS), "utf8");
    assert.doesNotMatch(src, /createDenaliFinanceOutboxConsumer/);
  });

  it("FIN-P1.7-C2-01 process module has no Denali consumer / side-effect names", () => {
    const src = readFileSync(resolve(REPO_ROOT, PROCESS), "utf8");
    assert.doesNotMatch(src, /consumeDenaliTourCreatedFinanceOutbox/);
    assert.doesNotMatch(src, /runTourCreatedFinanceSideEffect/);
    assert.doesNotMatch(src, /@app-tour\/workspace-denali/);
    assert.match(src, /resolveWorkspaceFinanceEventReaction/);
    assert.match(src, /WorkspaceFinanceEventReactionPort|reactToPublishedRow|consumePendingForTenant/);
  });

  it("FIN-P1.7-C2-02 outbox reader has no Denali package imports", () => {
    const src = readFileSync(resolve(REPO_ROOT, READER), "utf8");
    assert.doesNotMatch(src, /@app-tour\/workspace-denali/);
    assert.doesNotMatch(src, /DenaliOutboxDomainEvent|TourCreatedLedgerPayload/);
    assert.match(src, /FinanceWorkspaceOutboxEvent|FinanceWorkspaceOutboxReader/);
  });

  it("FIN-P1.7-C2-03 / P1.9 Denali reaction adapter owns Denali composition in workspace package", () => {
    const src = readFileSync(resolve(REPO_ROOT, ADAPTER), "utf8");
    assert.match(src, /consumeDenaliTourCreatedFinanceOutbox/);
    assert.match(src, /runTourCreatedFinanceSideEffect/);
    assert.match(src, /implements WorkspaceFinanceEventReactionPort/);
    assert.doesNotMatch(src, /from ["'].*prisma-workspace-outbox|from ["'].*workspace-finance-processed-log|from ["']apps\/api/);
  });

  it("FIN-P1.8-S1-01 dispatcher routes TourCreated finance via process, not Denali run", () => {
    const src = readFileSync(resolve(REPO_ROOT, DISPATCHER), "utf8");
    assert.match(src, /processWorkspaceFinanceTourCreatedRow/);
    assert.match(src, /isWorkspaceFinanceEventReactionRegistered/);
    assert.match(src, /eventType === ["']TourCreated["']/);
    assert.doesNotMatch(src, /runTourCreatedFinanceSideEffect/);
    assert.doesNotMatch(src, /@app-tour\/workspace-denali/);
  });

  it("FIN-P1.8-S1-02 generated bindings do not dispatch Denali finance run", () => {
    const src = readFileSync(resolve(REPO_ROOT, GENERATED), "utf8");
    assert.match(src, /WORKSPACE_OUTBOX_SIDE_EFFECT_BINDINGS[\s\S]*=\s*\[\]/);
    assert.doesNotMatch(src, /run:\s*runTourCreatedFinanceSideEffect/);
    assert.match(src, /registerTourCreatedFinanceSideEffectDeps/);
  });

  it("FIN-P1.8-S1-03 reaction registry fail-closed for unknown workspace", () => {
    assert.equal(isWorkspaceFinanceEventReactionRegistered("denali"), true);
    assert.equal(isWorkspaceFinanceEventReactionRegistered("finance-ws2"), false);
    assert.equal(isWorkspaceFinanceEventReactionRegistered("starter"), false);
    assert.throws(
      () => resolveWorkspaceFinanceEventReaction("finance-ws2"),
      /FINANCE_EVENT_REACTION_UNSUPPORTED/
    );
    assert.throws(
      () => resolveWorkspaceFinanceEventReaction("starter"),
      /FINANCE_EVENT_REACTION_UNSUPPORTED/
    );
    assert.throws(
      () => resolveWorkspaceFinanceEventReaction("  "),
      /FINANCE_EVENT_REACTION_UNSUPPORTED/
    );
    const port = resolveWorkspaceFinanceEventReaction("denali");
    assert.equal(typeof port.reactToPublishedRow, "function");
    assert.equal(typeof port.consumePendingForTenant, "function");
  });

  it("FIN-P1.9-01 API infrastructure keeps only booking host adapters", () => {
    const infra = readdirSync(resolve(REPO_ROOT, INFRA));
    assert.deepEqual(
      [...infra].filter((n) => n.endsWith(".ts")).sort(),
      ["booking-payment.adapter.ts", "booking-registration-display.adapter.ts"].sort()
    );
  });

  it("FIN-P1.9-02 / P1.10 registries resolve via generated bindings (no hand adapter Maps)", () => {
    const dep = readFileSync(resolve(REPO_ROOT, DEPENDENCY_REGISTRY), "utf8");
    assert.match(dep, /workspace-finance-dependency-bindings\.generated/);
    assert.doesNotMatch(dep, /DenaliFinanceLedgerPolicyAdapter|FinanceWs2LedgerPolicyAdapter/);
    assert.doesNotMatch(dep, /from ["']@app-tour\/workspace-denali["']/);
    assert.match(dep, /BookingPaymentAdapter/);

    const reaction = readFileSync(resolve(REPO_ROOT, REACTION_REGISTRY), "utf8");
    assert.match(reaction, /workspace-finance-event-reaction-bindings\.generated/);
    assert.doesNotMatch(reaction, /DenaliTourCreatedFinanceReactionAdapter/);
    assert.doesNotMatch(reaction, /new Map\(\[\[/);
  });

  it("FIN-P1.10-01 generated dependency bindings include denali and finance-ws2", () => {
    const gen = readFileSync(
      resolve(REPO_ROOT, "apps/api/src/workspace-finance/workspace-finance-dependency-bindings.generated.ts"),
      "utf8"
    );
    assert.match(gen, /"denali"/);
    assert.match(gen, /"finance-ws2"/);
    assert.match(gen, /DenaliFinanceLedgerPolicyAdapter|denali_LedgerPolicy/);
    assert.match(gen, /FinanceWs2LedgerPolicyAdapter|finance_ws2_LedgerPolicy/);
  });

  it("FIN-P1.10-02 generated event reaction bindings include denali only", () => {
    const gen = readFileSync(
      resolve(
        REPO_ROOT,
        "apps/api/src/workspace-finance/workspace-finance-event-reaction-bindings.generated.ts"
      ),
      "utf8"
    );
    assert.match(gen, /"denali"/);
    assert.doesNotMatch(gen, /"finance-ws2"/);
    assert.match(gen, /requiresHostIo:\s*true/);
  });

  it("FIN-P1.10-03 chart of accounts capability fail-closed + Denali/WS2 registered", () => {
    assert.equal(isFinanceChartOfAccountsRegistered("denali"), true);
    assert.equal(isFinanceChartOfAccountsRegistered("finance-ws2"), true);
    assert.equal(isFinanceChartOfAccountsRegistered("starter"), false);
    assert.throws(
      () => resolveFinanceChartOfAccounts("starter"),
      /FINANCE_CHART_OF_ACCOUNTS_UNSUPPORTED/
    );
    const denaliCoa = resolveFinanceChartOfAccounts("denali");
    assert.equal(denaliCoa.REGISTRATION_LEADER_PAYMENT_CLEARING, "gl:leader-registration-payment-clearing");
    const ws2Coa = resolveFinanceChartOfAccounts("finance-ws2");
    assert.equal(ws2Coa.OPERATOR_CASH_CLEARING, "ws2:gl:operator-cash-clearing");
  });

  it("FIN-P1.9.1-01 FinanceService has no infrastructure adapter imports or concrete defaults", () => {
    const src = readFileSync(resolve(REPO_ROOT, "apps/api/src/workspace-finance/finance.service.ts"), "utf8");
    assert.doesNotMatch(src, /BookingPaymentAdapter|BookingRegistrationDisplayAdapter|createFinanceRepository/);
    assert.doesNotMatch(src, /infrastructure\//);
    assert.match(src, /registrationDisplay: RegistrationDisplayPort/);
  });

  it("FIN-P1.9.1-02 repository factory requires bookingPayments (no default adapter)", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "apps/api/src/workspace-finance/finance-repository.factory.ts"),
      "utf8"
    );
    assert.doesNotMatch(src, /BookingPaymentAdapter|new Booking/);
    assert.match(src, /bookingPayments: IBookingPaymentPort/);
  });
});
