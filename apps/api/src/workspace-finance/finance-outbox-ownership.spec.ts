/**
 * Phase 1.7 / 1.8 — finance host TourCreated reaction ownership.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import {
  isWorkspaceFinanceEventReactionRegistered,
  resolveWorkspaceFinanceEventReaction,
} from "./finance-event-reaction-registry";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../");
const PROCESS = "apps/api/src/workspace-finance/process-workspace-finance-outbox.ts";
const READER = "apps/api/src/workspace-finance/prisma-workspace-outbox-reader.ts";
const ADAPTER =
  "apps/api/src/workspace-finance/infrastructure/denali-tour-created-finance-reaction.adapter.ts";
const DISPATCHER = "apps/api/src/workspace/workspace-tour-created-dispatcher.ts";
const GENERATED = "apps/api/src/workspace/workspace-outbox-side-effects.generated.ts";

describe("finance-outbox-ownership.spec.ts — Phase 1.7 / 1.8", () => {
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

  it("FIN-P1.7-C2-03 Denali reaction adapter owns Denali composition", () => {
    const src = readFileSync(resolve(REPO_ROOT, ADAPTER), "utf8");
    assert.match(src, /consumeDenaliTourCreatedFinanceOutbox/);
    assert.match(src, /runTourCreatedFinanceSideEffect/);
    assert.match(src, /implements WorkspaceFinanceEventReactionPort/);
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
});
