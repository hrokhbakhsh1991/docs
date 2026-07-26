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

  it("FIN-P1.8-S1-02 / P1.9 generated outbox has no Denali finance façade exports", () => {
    const src = readFileSync(resolve(REPO_ROOT, GENERATED), "utf8");
    assert.match(src, /WORKSPACE_OUTBOX_SIDE_EFFECT_BINDINGS[\s\S]*=\s*\[\]/);
    assert.doesNotMatch(src, /run:\s*runTourCreatedFinanceSideEffect/);
    assert.doesNotMatch(src, /registerTourCreatedFinanceSideEffectDeps/);
    assert.doesNotMatch(src, /runTourCreatedFinanceSideEffect/);
    assert.doesNotMatch(src, /@app-tour\/workspace-denali/);
    assert.doesNotMatch(src, /workspace-denali/);
  });

  it("FIN-P1.8-S1-03 / P1.9 reaction registry: Denali + finance-ws5; demoted/unknown fail closed", async () => {
    assert.equal(isWorkspaceFinanceEventReactionRegistered("denali"), true);
    assert.equal(isWorkspaceFinanceEventReactionRegistered("finance-ws5"), true);
    assert.equal(isWorkspaceFinanceEventReactionRegistered("finance-ws2"), false);
    assert.equal(isWorkspaceFinanceEventReactionRegistered("starter"), false);
    await assert.rejects(() => resolveWorkspaceFinanceEventReaction("starter"),
      /FINANCE_EVENT_REACTION_UNSUPPORTED/
    );
    await assert.rejects(() => resolveWorkspaceFinanceEventReaction("urban"),
      /FINANCE_EVENT_REACTION_UNSUPPORTED/
    );
    await assert.rejects(() => resolveWorkspaceFinanceEventReaction("  "),
      /FINANCE_EVENT_REACTION_UNSUPPORTED/
    );
    const denali = await resolveWorkspaceFinanceEventReaction("denali");
    assert.equal(typeof denali.reactToPublishedRow, "function");
    assert.equal(typeof denali.consumePendingForTenant, "function");
    const ws5 = await resolveWorkspaceFinanceEventReaction("finance-ws5");
    assert.equal(typeof ws5.reactToPublishedRow, "function");
    assert.notEqual(denali.constructor, ws5.constructor);
  });

  it("FIN-P1.9-01 API infrastructure keeps booking + host finance adapters (no workspace policy)", () => {
    const infra = readdirSync(resolve(REPO_ROOT, INFRA));
    assert.deepEqual(
      [...infra].filter((n) => n.endsWith(".ts")).sort(),
      [
        "booking-payment.adapter.ts",
        "booking-registration-display.adapter.ts",
        "host-finance-access.adapter.ts",
        "host-finance-capability.adapter.ts",
        "host-finance-clock.adapter.ts",
        "host-finance-log.adapter.ts",
        "host-finance-metrics.adapter.ts",
        "host-finance-persistence-mode.adapter.ts",
        "host-finance-receipt-proof-url.adapter.ts",
        "host-finance-schedule.adapter.ts",
        "prisma-finance.repository.ts",
        "prisma-workspace-outbox-writer.ts",
        "registration-finance-obligation.adapter.ts",
      ].sort()
    );
  });

  it("FIN-P1.9-02 / P1.10 registries resolve via generated bindings (no hand adapter Maps)", () => {
    const dep = readFileSync(resolve(REPO_ROOT, DEPENDENCY_REGISTRY), "utf8");
    assert.match(dep, /workspace-finance-dependency-bindings\.generated/);
    assert.doesNotMatch(dep, /DenaliFinanceLedgerPolicyAdapter|FinanceWs2LedgerPolicyAdapter/);
    assert.doesNotMatch(dep, /from ["']@app-tour\/workspace-denali["']/);
    assert.match(dep, /createBookingPaymentPort/);

    const reaction = readFileSync(resolve(REPO_ROOT, REACTION_REGISTRY), "utf8");
    assert.match(reaction, /workspace-finance-event-reaction-bindings\.generated/);
    assert.doesNotMatch(reaction, /DenaliTourCreatedFinanceReactionAdapter/);
    assert.doesNotMatch(reaction, /new Map\(\[\[/);
    assert.doesNotMatch(reaction, /@app-tour\/workspace-denali/);
    assert.doesNotMatch(reaction, /DenaliOutboxDomainEvent/);
  });

  it("FIN-EVENT-NEUTRAL-01 generic finance event runtime has zero workspace package imports", () => {
    const runtimeFiles = [
      PROCESS,
      READER,
      DISPATCHER,
      REACTION_REGISTRY,
      "apps/api/src/workspace-finance/infrastructure/prisma-workspace-outbox-writer.ts",
      "apps/api/src/workspace-finance/workspace-finance-processed-log.ts",
      "apps/api/src/workspace-finance/enqueue-finance-ledger-capture.ts",
    ];
    for (const rel of runtimeFiles) {
      const src = readFileSync(resolve(REPO_ROOT, rel), "utf8");
      assert.doesNotMatch(
        src,
        /from ["']@app-tour\/workspace-denali/,
        `${rel} must not import workspace-denali`
      );
      assert.doesNotMatch(
        src,
        /from ["']@app-tour\/workspace-finance-ws/,
        `${rel} must not import workspace-finance-ws*`
      );
      assert.doesNotMatch(src, /runTourCreatedFinanceSideEffect/);
      assert.doesNotMatch(src, /consumeDenaliTourCreatedFinanceOutbox/);
    }
  });

  it("FIN-P1.10-01 generated dependency bindings include denali and finance-ws2", () => {
    const gen = readFileSync(
      resolve(REPO_ROOT, "apps/api/src/workspace-finance/workspace-finance-dependency-bindings.generated.ts"),
      "utf8"
    );
    assert.match(gen, /"denali"/);
    assert.match(gen, /"finance-ws2"/);
    assert.match(gen, /DenaliFinanceLedgerPolicyAdapter/);
    assert.match(gen, /FinanceWs2LedgerPolicyAdapter/);
    assert.match(gen, /await import\("@app-tour\/workspace-denali\/host\/finance"\)/);
    assert.doesNotMatch(gen, /^import \{/m);
  });

  it("FIN-P1.10-02 / P1.9 generated event reaction bindings include denali and finance-ws5 only", () => {
    const gen = readFileSync(
      resolve(
        REPO_ROOT,
        "apps/api/src/workspace-finance/workspace-finance-event-reaction-bindings.generated.ts"
      ),
      "utf8"
    );
    assert.match(gen, /"denali"/);
    assert.match(gen, /"finance-ws5"/);
    assert.doesNotMatch(gen, /"finance-ws2"/);
    assert.doesNotMatch(gen, /"finance-ws3"/);
    assert.match(gen, /requiresHostIo:\s*true/);
    assert.match(gen, /requiresHostIo:\s*false/);
  });

  it("FIN-P1.9-EO-01 / P1.13 apps/api has no Denali finance side-effect boot registrar", () => {
    const processSrc = readFileSync(resolve(REPO_ROOT, PROCESS), "utf8");
    const dispatcherSrc = readFileSync(resolve(REPO_ROOT, DISPATCHER), "utf8");
    const reactionSrc = readFileSync(resolve(REPO_ROOT, REACTION_REGISTRY), "utf8");
    const appSrc = readFileSync(resolve(REPO_ROOT, "apps/api/src/app.ts"), "utf8");
    for (const src of [processSrc, dispatcherSrc, reactionSrc, appSrc]) {
      assert.doesNotMatch(src, /register-workspace-finance-deps/);
      assert.doesNotMatch(src, /registerTourCreatedFinanceSideEffectDeps/);
      assert.doesNotMatch(src, /@app-tour\/workspace-denali/);
      assert.doesNotMatch(src, /api-tour-created-adapter/);
    }
    assert.match(reactionSrc, /tryClaimWorkspaceFinanceProcessedEvent|tryClaimProcessedEvent/);
    assert.match(reactionSrc, /PlatformFinanceEventReactionHostIo/);
  });

  it("FIN-P1.9-EO-02 / P1.13 Denali reaction works through registry HostIo (no boot register)", async () => {
    const port = await resolveWorkspaceFinanceEventReaction("denali");
    const skipped = await port.reactToPublishedRow({
      tenantId: "00000000-0000-4000-8000-000000000014",
      domainEventId: "test-no-finance-payload",
      eventType: "TourCreated",
      aggregateType: "tour",
      aggregateId: "00000000-0000-4000-8000-000000000099",
      payload: { tenantId: "00000000-0000-4000-8000-000000000014" },
    });
    assert.equal(skipped, false);
  });

  it("FIN-P1.13-01 Denali HostIo includes claim + log; adapter does not use module singleton for production path", () => {
    const adapter = readFileSync(resolve(REPO_ROOT, ADAPTER), "utf8");
    assert.match(adapter, /tryClaimProcessedEvent/);
    assert.match(adapter, /logReactionFailed/);
    assert.match(adapter, /sideEffectDeps/);
    assert.doesNotMatch(adapter, /registerTourCreatedFinanceSideEffectDeps/);
  });

  it("FIN-P1.9-EO-03 demoted registry fixtures have no TourCreated reaction (fail-closed)", async () => {
    assert.equal(isWorkspaceFinanceEventReactionRegistered("finance-ws2"), false);
    assert.equal(isWorkspaceFinanceEventReactionRegistered("finance-ws3"), false);
    assert.equal(isWorkspaceFinanceEventReactionRegistered("finance-ws4"), false);
    assert.equal(isWorkspaceFinanceEventReactionRegistered("finance-ws6"), false);
    await assert.rejects(() => resolveWorkspaceFinanceEventReaction("finance-ws2"),
      /FINANCE_EVENT_REACTION_UNSUPPORTED|unsupported/i
    );
  });

  it("FIN-P1.10-03 chart of accounts capability fail-closed + Denali/WS2 registered", async () => {
    assert.equal(isFinanceChartOfAccountsRegistered("denali"), true);
    assert.equal(isFinanceChartOfAccountsRegistered("finance-ws2"), true);
    assert.equal(isFinanceChartOfAccountsRegistered("starter"), false);
    await assert.rejects(
      () => resolveFinanceChartOfAccounts("starter"),
      /FINANCE_CHART_OF_ACCOUNTS_UNSUPPORTED/
    );
    const denaliCoa = await resolveFinanceChartOfAccounts("denali");
    assert.equal(denaliCoa.REGISTRATION_LEADER_PAYMENT_CLEARING, "gl:leader-registration-payment-clearing");
    const ws2Coa = await resolveFinanceChartOfAccounts("finance-ws2");
    assert.equal(ws2Coa.OPERATOR_CASH_CLEARING, "ws2:gl:operator-cash-clearing");
  });

  it("FIN-P1.9.1-01 FinanceService has no infrastructure adapter imports or concrete defaults", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "packages/finance-core/src/application/finance.service.ts"),
      "utf8"
    );
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
