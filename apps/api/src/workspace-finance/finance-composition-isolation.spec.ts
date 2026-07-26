/**
 * Finance B2.2 — runtime composition isolation (denali vs finance-ws5).
 * Proves platform booking/repo sharing is intentional + order-independent;
 * workspace policies / reactions stay isolated on each FinanceService.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, beforeEach, describe, it } from "node:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { FinanceWs5TourCreatedFinanceReactionAdapter } from "@app-tour/workspace-finance-ws5";
import {
  getOrCreateFinanceServiceForWorkspaceType,
  getPlatformFinanceCompositionSnapshot,
  resetLazyFinanceServiceForTests,
} from "../boot/lazy-finance-service.ts";
import { resolveFinanceWorkspaceDependencies } from "./finance-dependency-registry.ts";
import {
  resolveWorkspaceFinanceEventReaction,
} from "./finance-event-reaction-registry.ts";
import { resolveFinanceChartOfAccounts } from "./finance-chart-of-accounts-registry.ts";
import { BookingPaymentAdapter } from "./infrastructure/booking-payment.adapter.ts";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");

const DENALI = "denali";
const WS5 = "finance-ws5";

const TOUR_ROW = {
  tenantId: "00000000-0000-4000-8000-000000000014",
  domainEventId: "b22-tour-1",
  eventType: "TourCreated" as const,
  aggregateType: "tour",
  aggregateId: "00000000-0000-4000-8000-000000000066",
  payload: { tenantId: "00000000-0000-4000-8000-000000000014" },
};

async function assertWorkspacePolicyDivergence(): Promise<void> {
  const denaliDeps = await resolveFinanceWorkspaceDependencies(DENALI);
  const ws5Deps = await resolveFinanceWorkspaceDependencies(WS5);

  assert.notEqual(denaliDeps.ledgerPolicy, ws5Deps.ledgerPolicy);
  assert.notEqual(denaliDeps.receiptDefaults, ws5Deps.receiptDefaults);

  assert.deepEqual(denaliDeps.receiptDefaults.offlineReceiptPaymentDefaults(), {
    amountMinor: "2500000",
    currency: "IRR",
  });
  assert.deepEqual(ws5Deps.receiptDefaults.offlineReceiptPaymentDefaults(), {
    amountMinor: "12500",
    currency: "CAD",
  });

  const denaliCoa = await resolveFinanceChartOfAccounts(DENALI);
  const ws5Coa = await resolveFinanceChartOfAccounts(WS5);
  assert.notEqual(
    denaliCoa.REGISTRATION_LEADER_PAYMENT_CLEARING,
    ws5Coa.OPERATOR_CASH_CLEARING
  );
}

async function assertEventReactionDivergence(): Promise<void> {
  const ws5 = await resolveWorkspaceFinanceEventReaction(WS5);
  const denali = await resolveWorkspaceFinanceEventReaction(DENALI);
  assert.ok(ws5 instanceof FinanceWs5TourCreatedFinanceReactionAdapter);

  assert.equal(await ws5.reactToPublishedRow(TOUR_ROW), true);
  assert.deepEqual(ws5.handledDomainEventIds, [TOUR_ROW.domainEventId]);
  assert.equal(await denali.reactToPublishedRow(TOUR_ROW), false);
  assert.ok(!("handledDomainEventIds" in denali));
}

async function assertPlatformCompositionShared(
  denaliService: object,
  ws5Service: object
): Promise<void> {
  assert.notEqual(denaliService, ws5Service);
  const snap = getPlatformFinanceCompositionSnapshot();
  assert.ok(snap !== null);
  assert.ok(snap!.bookingPayments instanceof BookingPaymentAdapter);
  assert.deepEqual(snap!.cachedWorkspaceTypes, [DENALI, WS5].sort());

  // Registry resolve still allocates fresh booking adapters — composition must not use them.
  const registryDenali = await resolveFinanceWorkspaceDependencies(DENALI);
  assert.notEqual(
    registryDenali.bookingPayments,
    snap!.bookingPayments,
    "composition must not adopt registry per-call bookingPayments (first-wins risk)"
  );
}

describe("FIN-B2.2 finance composition isolation", { concurrency: false }, () => {
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
    resetLazyFinanceServiceForTests();
  });

  it("shared repository is intentional — Prisma path uses withTenantRls (tenant isolation)", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "apps/api/src/workspace-finance/infrastructure/prisma-finance.repository.ts"),
      "utf8"
    );
    const calls = (src.match(/\bwithTenantRls\s*\(/g) ?? []).length;
    assert.ok(calls >= 8, `expected >=8 withTenantRls calls, got ${calls}`);
    const factory = readFileSync(
      resolve(REPO_ROOT, "apps/api/src/workspace-finance/finance-repository.factory.ts"),
      "utf8"
    );
    assert.match(factory, /Process-wide finance repository \(intentional\)/);
    const lazy = readFileSync(resolve(REPO_ROOT, "apps/api/src/boot/lazy-finance-service.ts"), "utf8");
    assert.match(lazy, /no first-wins/);
    assert.doesNotMatch(lazy, /sharedBookingPayments = deps\.bookingPayments/);
  });

  it("Scenario A: denali then finance-ws5 — policy/reaction diverge; platform ports shared", async () => {
    const denaliService = await getOrCreateFinanceServiceForWorkspaceType(DENALI);
    const snapAfterDenali = getPlatformFinanceCompositionSnapshot();
    assert.ok(snapAfterDenali !== null);

    const ws5Service = await getOrCreateFinanceServiceForWorkspaceType(WS5);
    const snapAfterBoth = getPlatformFinanceCompositionSnapshot();
    assert.ok(snapAfterBoth !== null);

    assert.equal(snapAfterBoth!.bookingPayments, snapAfterDenali!.bookingPayments);
    assert.equal(snapAfterBoth!.repository, snapAfterDenali!.repository);
    assert.equal(denaliService, await getOrCreateFinanceServiceForWorkspaceType(DENALI));
    assert.equal(ws5Service, await getOrCreateFinanceServiceForWorkspaceType(WS5));

    await assertPlatformCompositionShared(denaliService, ws5Service);
    await assertWorkspacePolicyDivergence();
    await assertEventReactionDivergence();
  });

  it("Scenario B: finance-ws5 then denali — same shared ports (order-independent)", async () => {
    const ws5Service = await getOrCreateFinanceServiceForWorkspaceType(WS5);
    const snapAfterWs5 = getPlatformFinanceCompositionSnapshot();
    assert.ok(snapAfterWs5 !== null);

    const denaliService = await getOrCreateFinanceServiceForWorkspaceType(DENALI);
    const snapAfterBoth = getPlatformFinanceCompositionSnapshot();
    assert.ok(snapAfterBoth !== null);

    assert.equal(snapAfterBoth!.bookingPayments, snapAfterWs5!.bookingPayments);
    assert.equal(snapAfterBoth!.repository, snapAfterWs5!.repository);
    assert.notEqual(denaliService, ws5Service);

    await assertPlatformCompositionShared(denaliService, ws5Service);
    await assertWorkspacePolicyDivergence();
    await assertEventReactionDivergence();
  });

  it("workspaceType cache does not leak mutable reaction state across services", async () => {
    await getOrCreateFinanceServiceForWorkspaceType(DENALI);
    await getOrCreateFinanceServiceForWorkspaceType(WS5);

    const ws5a = await resolveWorkspaceFinanceEventReaction(WS5);
    assert.ok(ws5a instanceof FinanceWs5TourCreatedFinanceReactionAdapter);
    await ws5a.reactToPublishedRow({ ...TOUR_ROW, domainEventId: "leak-probe-1" });
    assert.deepEqual(ws5a.handledDomainEventIds, ["leak-probe-1"]);

    // Fresh resolve from registry creates a new adapter instance (no process cache on reactions).
    const ws5b = await resolveWorkspaceFinanceEventReaction(WS5);
    assert.ok(ws5b instanceof FinanceWs5TourCreatedFinanceReactionAdapter);
    assert.notEqual(ws5a, ws5b);
    assert.deepEqual(ws5b.handledDomainEventIds, []);

    // FinanceService instances remain distinct and cached by workspaceType only.
    const d1 = await getOrCreateFinanceServiceForWorkspaceType(DENALI);
    const d2 = await getOrCreateFinanceServiceForWorkspaceType(DENALI);
    const w1 = await getOrCreateFinanceServiceForWorkspaceType(WS5);
    assert.equal(d1, d2);
    assert.notEqual(d1, w1);
  });
});
