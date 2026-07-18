/**
 * Phase 1.7 — finance host TourCreated reaction ownership (C1 + C2).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../");
const PROCESS = "apps/api/src/workspace-finance/process-workspace-finance-outbox.ts";
const READER = "apps/api/src/workspace-finance/prisma-workspace-outbox-reader.ts";
const ADAPTER =
  "apps/api/src/workspace-finance/infrastructure/denali-tour-created-finance-reaction.adapter.ts";

describe("finance-outbox-ownership.spec.ts — Phase 1.7", () => {
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
});
