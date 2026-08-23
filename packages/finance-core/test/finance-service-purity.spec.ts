/**
 * Post-port-migration purity: FinanceService compiles and constructs with fake adapters only.
 * No apps/api, Prisma, env, or host singletons.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { createFinanceService } from "../src/application/finance.service.ts";
import type { IBookingPaymentPort } from "../src/ports/booking-payment.port.ts";
import type { FinanceAuthorizationPort } from "../src/ports/finance-access.port.ts";
import type { FinanceCapabilityPort } from "../src/ports/finance-capability.port.ts";
import type { FinanceClockPort } from "../src/ports/finance-clock.port.ts";
import type { FinanceLedgerPolicyPort } from "../src/ports/finance-ledger-policy.port.ts";
import type { FinanceLoggerPort } from "../src/ports/finance-log.port.ts";
import type { FinanceMetricsPort } from "../src/ports/finance-metrics.port.ts";
import type { FinanceStorageDriverPort } from "../src/ports/finance-persistence-mode.port.ts";
import type { FinanceReceiptDefaultsPort } from "../src/ports/finance-receipt-defaults.port.ts";
import type { ReceiptProofStoragePort } from "../src/ports/finance-receipt-proof-url.port.ts";
import type { FinanceRepositoryPort } from "../src/ports/finance-repository.port.ts";
import type { FinanceSchedulePort } from "../src/ports/finance-schedule.port.ts";
import type { RegistrationDisplayPort } from "../src/ports/registration-display.port.ts";

const SERVICE = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../src/application/finance.service.ts"
);
const IN_MEMORY_REPOSITORY_FAKE = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "isolation/in-memory-finance.repository.ts"
);

const fakeLedger: FinanceLedgerPolicyPort = {
  buildPaymentCaptureJournal: () => ({
    journalId: "j",
    domainEventId: "d",
    lines: [],
  }),
  buildPrepaymentJournal: () => ({
    journalId: "j",
    domainEventId: "d",
    lines: [],
  }),
};

const fakeRepo = {
  getSummary: async () => ({
    pendingManualPayments: 0,
    pendingReceiptReviews: 0,
    paidPayments: 0,
    failedPayments: 0,
    cancelledPayments: 0,
  }),
} as unknown as FinanceRepositoryPort;

const fakeBooking: IBookingPaymentPort = {
  syncStatus: async () => null,
  raisePaidInTx: async () => "paid",
  memberOwnsRegistration: async () => false,
  getPaymentStatus: async () => null,
  getRegistrationLifecycleStatus: async () => null,
};

const fakeDefaults: FinanceReceiptDefaultsPort = {
  offlineReceiptPaymentDefaults: () => ({ amountMinor: "0", currency: "IRR" }),
};

const fakeDisplay: RegistrationDisplayPort = {
  getByRegistrationIds: async () => new Map(),
  listRegistrationIdsByTourId: async () => [],
};

const fakeMetrics: FinanceMetricsPort = { increment() {} };
const fakeStorage: FinanceStorageDriverPort = {
  isDurablePersistence: () => false,
  isDatabaseConfigured: () => false,
};
const fakeProof: ReceiptProofStoragePort = {
  getSignedReadUrl: async () => "https://example.test/proof",
};
const fakeCapability: FinanceCapabilityPort = {
  assertEnabled: async () => ({ workspaceType: "test", theme: {} }),
};
const fakeAuthz: FinanceAuthorizationPort = {
  assertOperatorAccess() {},
  assertReceiptSubmitAccess() {},
};
const fakeSchedules: FinanceSchedulePort = {
  listAllSchedules: async () => [],
  getSchedule: async () => [],
  putSchedule: async (_t, _r, items) => items,
};
const fakeLog: FinanceLoggerPort = { warn() {}, error() {} };
const fakeClock: FinanceClockPort = { nowIso: () => "2026-01-15T12:00:00.000Z" };

describe("FIN-P2.2.x FinanceService pure application service", () => {
  it("source has zero forbidden host / Prisma / env / dynamic-import symbols", () => {
    const src = readFileSync(SERVICE, "utf8");
    assert.doesNotMatch(src, /process\.env/);
    assert.doesNotMatch(src, /console\./);
    assert.doesNotMatch(src, /metricsRegistry/);
    assert.doesNotMatch(src, /resolveStorageDriver/);
    assert.doesNotMatch(src, /isFinanceModuleEnabled|assertFinanceWorkspaceGate/);
    assert.doesNotMatch(src, /await import\(|[^.]import\(/);
    assert.doesNotMatch(src, /node:fs|from ["']fs["']/);
    assert.doesNotMatch(src, /@prisma\/client|Prisma\./);
    assert.doesNotMatch(src, /apps\/api|@apps\/api/);
    assert.doesNotMatch(src, /@app-tour\/workspace-/);
    assert.match(src, /FinanceCapabilityPort/);
    assert.match(src, /capability\.assertEnabled/);
  });

  it("test repository fake does not invent a product currency for invoice facts", () => {
    const src = readFileSync(IN_MEMORY_REPOSITORY_FAKE, "utf8");
    assert.doesNotMatch(src, /let\s+currency\s*=\s*"IRR"/);
  });

  it("constructs via createFinanceService with fake adapters only", async () => {
    const service = createFinanceService(
      fakeLedger,
      fakeRepo,
      fakeBooking,
      fakeDefaults,
      fakeDisplay,
      fakeMetrics,
      fakeStorage,
      fakeProof,
      fakeCapability,
      fakeAuthz,
      fakeSchedules,
      fakeLog,
      fakeClock
    );
    assert.equal(typeof service.getSummary, "function");
    const summary = await service.getSummary({
      userId: "u",
      tenantId: "00000000-0000-4000-8000-000000000001",
      role: "admin",
      status: "ACTIVE",
    });
    assert.equal(summary.pendingManualPayments, 0);
  });
});
