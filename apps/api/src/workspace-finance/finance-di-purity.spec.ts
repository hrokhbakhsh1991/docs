/**
 * Phase 1.9.1 / composition-root mandatory — FinanceService must not construct infrastructure.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, it } from "node:test";

import {
  resetLazyFinanceServiceForTests,
  resolveFinanceServiceForTenant,
  resolveLazyFinanceService,
} from "../boot/lazy-finance-service.ts";
import { OPERATOR_SMOKE } from "../../test/fixtures/operator-smoke-e2e-tenant.ts";
import {
  createFinanceRepository,
  resetFinanceRepositoryForTests,
} from "./finance-repository.factory.ts";
import {
  resolveFinanceReceiptDefaults,
  resolveFinanceWorkspaceDependencies,
} from "./finance-dependency-registry.ts";
import { createFinanceService, FinanceService } from "./finance.service.ts";
import { BookingPaymentAdapter } from "./infrastructure/booking-payment.adapter.ts";
import { BookingRegistrationDisplayAdapter } from "./infrastructure/booking-registration-display.adapter.ts";
import { DenaliFinanceLedgerPolicyAdapter } from "@app-tour/workspace-denali";
import { DenaliFinanceReceiptDefaultsAdapter } from "@app-tour/workspace-denali";
import {
  InMemoryFinanceRepository,
  resetInMemoryFinanceRepositoryForTests,
} from "./in-memory-finance.repository.ts";
import {
  fakeEmptySchedules,
  fakeMemoryPersistenceMode,
  fakeFixedClock,
  fakeNoopLog,
  fakeNoopMetrics,
  fakePermissiveCapability,
  fakePermissiveAccess,
  fakeReceiptProofUrl,
} from "./finance-service-host-fakes.ts";
import { HostFinanceMetricsAdapter } from "./infrastructure/host-finance-metrics.adapter.ts";
import { HostFinancePersistenceModeAdapter } from "./infrastructure/host-finance-persistence-mode.adapter.ts";
import { HostFinanceReceiptProofUrlAdapter } from "./infrastructure/host-finance-receipt-proof-url.adapter.ts";
import { HostFinanceAccessAdapter } from "./infrastructure/host-finance-access.adapter.ts";
import { HostFinanceCapabilityAdapter } from "./infrastructure/host-finance-capability.adapter.ts";
import { HostFinanceScheduleAdapter } from "./infrastructure/host-finance-schedule.adapter.ts";
import { HostFinanceLogAdapter } from "./infrastructure/host-finance-log.adapter.ts";
import { HostFinanceClockAdapter } from "./infrastructure/host-finance-clock.adapter.ts";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../");
const DENALI = "denali";
const DENALI_TENANT_ID = OPERATOR_SMOKE.tenantId;

describe("finance-di-purity.spec.ts — composition root mandatory", { concurrency: false }, () => {
  const priorStorageDriver = process.env.STORAGE_DRIVER;
  const priorDatabaseUrl = process.env.DATABASE_URL;

  before(() => {
    process.env.STORAGE_DRIVER = "memory";
    delete process.env.DATABASE_URL;
  });

  after(() => {
    resetLazyFinanceServiceForTests();
    resetFinanceRepositoryForTests();
    resetInMemoryFinanceRepositoryForTests();
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

  it("FIN-DI-01 missing dependency fails fast (service + repository factory)", () => {
    const bookingPayments = new BookingPaymentAdapter();
    const repo = new InMemoryFinanceRepository(bookingPayments);
    const ledger = new DenaliFinanceLedgerPolicyAdapter();
    const defaults = new DenaliFinanceReceiptDefaultsAdapter();
    const display = new BookingRegistrationDisplayAdapter();

    assert.throws(
      () =>
        new FinanceService(
          undefined as never,
          repo,
          bookingPayments,
          defaults,
          display,
          fakeNoopMetrics,
          fakeMemoryPersistenceMode,
          fakeReceiptProofUrl,
          fakePermissiveCapability,
          fakePermissiveAccess,
          fakeEmptySchedules,
          fakeNoopLog,
          fakeFixedClock
        ),
      /FINANCE_SERVICE_DEP_REQUIRED: ledgerPolicy/
    );
    assert.throws(
      () =>
        new FinanceService(
          ledger,
          repo,
          bookingPayments,
          defaults,
          undefined as never,
          fakeNoopMetrics,
          fakeMemoryPersistenceMode,
          fakeReceiptProofUrl,
          fakePermissiveCapability,
          fakePermissiveAccess,
          fakeEmptySchedules,
          fakeNoopLog,
          fakeFixedClock
        ),
      /FINANCE_SERVICE_DEP_REQUIRED: registrationDisplay/
    );
    assert.throws(
      () =>
        new FinanceService(
          ledger,
          repo,
          bookingPayments,
          defaults,
          display,
          undefined as never,
          fakeMemoryPersistenceMode,
          fakeReceiptProofUrl,
          fakePermissiveCapability,
          fakePermissiveAccess,
          fakeEmptySchedules,
          fakeNoopLog,
          fakeFixedClock
        ),
      /FINANCE_SERVICE_DEP_REQUIRED: metrics/
    );
    assert.throws(
      () =>
        new FinanceService(
          ledger,
          repo,
          bookingPayments,
          defaults,
          display,
          fakeNoopMetrics,
          fakeMemoryPersistenceMode,
          fakeReceiptProofUrl,
          fakePermissiveCapability,
          fakePermissiveAccess,
          fakeEmptySchedules,
          fakeNoopLog,
          undefined as never
        ),
      /FINANCE_SERVICE_DEP_REQUIRED: clock/
    );
    assert.throws(
      () => createFinanceRepository(undefined as never),
      /FINANCE_REPOSITORY_BOOKING_PAYMENTS_REQUIRED/
    );

    const serviceSrc = readFileSync(
      resolve(REPO_ROOT, "packages/finance-core/src/application/finance.service.ts"),
      "utf8"
    );
    assert.doesNotMatch(
      serviceSrc,
      /BookingPaymentAdapter|BookingRegistrationDisplayAdapter|createFinanceRepository/
    );
    assert.doesNotMatch(serviceSrc, /infrastructure\//);
    assert.doesNotMatch(serviceSrc, /=\s*createFinanceRepository\(\)/);
    assert.doesNotMatch(serviceSrc, /=\s*new BookingPaymentAdapter\(\)/);
    assert.doesNotMatch(serviceSrc, /=\s*new BookingRegistrationDisplayAdapter\(\)/);
    assert.doesNotMatch(serviceSrc, /@prisma\/client/);
    assert.doesNotMatch(
      serviceSrc,
      /observability\/metrics|production-storage-driver-assert|receipt-proof-storage/
    );
    assert.match(serviceSrc, /FinanceMetricsPort/);
    assert.match(serviceSrc, /FinanceStorageDriverPort/);
    assert.match(serviceSrc, /ReceiptProofStoragePort/);
    assert.match(serviceSrc, /FinanceCapabilityPort/);
    assert.match(serviceSrc, /FinanceAuthorizationPort/);
    assert.match(serviceSrc, /capability\.assertEnabled/);
    assert.doesNotMatch(serviceSrc, /assertWorkspaceGate/);
    assert.match(serviceSrc, /FinanceSchedulePort/);
    assert.match(serviceSrc, /FinanceLoggerPort/);
    assert.match(serviceSrc, /FinanceActorContext/);
    assert.match(serviceSrc, /FinanceClockPort/);
    assert.doesNotMatch(serviceSrc, /@app-tour\/workspace-sdk/);
    assert.doesNotMatch(serviceSrc, /assert-finance-access|finance-schedule-store|console\.(warn|error)/);
    assert.doesNotMatch(serviceSrc, /process\.env\.DATABASE_URL/);
    assert.doesNotMatch(serviceSrc, /workspace-/);
    // Phase 1.16/1.20 acceptance — FinanceService must not reference host modules/env/console/wall clock.
    assert.doesNotMatch(serviceSrc, /apps\/api|Prisma|process\.env|console|workspace-/);
    assert.doesNotMatch(serviceSrc, /new Date\(|Date\.now\(/);
    assert.doesNotMatch(serviceSrc, /withTenantRls|enqueueOutboxEvent|enqueueFinanceLedgerCapture/);
    assert.doesNotMatch(
      serviceSrc,
      /from ["']\.\/finance\.repository["']|from ["']\.\/infrastructure\/prisma-finance/
    );
    assert.match(
      serviceSrc,
      /from ["']\.\.\/ports\/finance-repository\.port["']/
    );

    const inMemorySrc = readFileSync(
      resolve(REPO_ROOT, "apps/api/src/workspace-finance/in-memory-finance.repository.ts"),
      "utf8"
    );
    assert.doesNotMatch(inMemorySrc, /@prisma\/client|withTenantRls/);
    assert.match(
      inMemorySrc,
      /from ["']\.\/ports\/finance-repository\.port["']/
    );
    assert.match(inMemorySrc, /implements FinanceRepositoryPort/);

    const factorySrc = readFileSync(
      resolve(REPO_ROOT, "apps/api/src/workspace-finance/finance-repository.factory.ts"),
      "utf8"
    );
    assert.doesNotMatch(factorySrc, /BookingPaymentAdapter|=\s*new Booking/);
    assert.match(factorySrc, /FinanceRepositoryPort/);
    assert.match(factorySrc, /PrismaFinanceRepository/);
    assert.doesNotMatch(
      factorySrc,
      /export type FinanceRepositoryPort\s*=/,
      "factory must not redefine FinanceRepositoryPort as a concrete union"
    );

    const facadeSrc = readFileSync(
      resolve(REPO_ROOT, "apps/api/src/workspace-finance/finance.repository.ts"),
      "utf8"
    );
    assert.match(facadeSrc, /from ["']\.\/ports\/finance-repository\.port["']/);
    assert.doesNotMatch(
      facadeSrc,
      /PrismaFinanceRepository|as FinanceRepository|@prisma\/client|withTenantRls/
    );

    const portsDir = resolve(REPO_ROOT, "apps/api/src/workspace-finance/ports");
    for (const name of readdirSync(portsDir).filter((n) => n.endsWith(".ts"))) {
      const portSrc = readFileSync(resolve(portsDir, name), "utf8");
      assert.doesNotMatch(
        portSrc,
        /from ["']@prisma\/client["']|import\s+type\s+\{\s*Prisma|Prisma\.TransactionClient|withTenantRls/,
        `ports/${name} must not import Prisma types or withTenantRls`
      );
    }
  });

  it("FIN-DI-02 registry-created service works via composition root", async () => {
    resetLazyFinanceServiceForTests();
    resetFinanceRepositoryForTests();

    const deps = resolveFinanceWorkspaceDependencies(DENALI);
    assert.ok(deps.ledgerPolicy instanceof DenaliFinanceLedgerPolicyAdapter);
    assert.ok(deps.receiptDefaults instanceof DenaliFinanceReceiptDefaultsAdapter);
    assert.ok(deps.bookingPayments instanceof BookingPaymentAdapter);

    const fromTenant = await resolveFinanceServiceForTenant(DENALI_TENANT_ID);
    assert.equal(typeof fromTenant.getSummary, "function");
    const lazy = await resolveLazyFinanceService();
    assert.equal(lazy, fromTenant);
  });

  it("FIN-DI-03 existing Denali behavior unchanged (receipt defaults + policy class)", () => {
    const defaults = resolveFinanceReceiptDefaults(DENALI);
    assert.ok(defaults instanceof DenaliFinanceReceiptDefaultsAdapter);
    assert.deepEqual(defaults.offlineReceiptPaymentDefaults(), {
      amountMinor: "2500000",
      currency: "IRR",
    });

    const deps = resolveFinanceWorkspaceDependencies(DENALI);
    assert.ok(deps.ledgerPolicy instanceof DenaliFinanceLedgerPolicyAdapter);

    const bookingPayments = new BookingPaymentAdapter();
    const service = createFinanceService(
      deps.ledgerPolicy,
      new InMemoryFinanceRepository(bookingPayments),
      bookingPayments,
      deps.receiptDefaults,
      new BookingRegistrationDisplayAdapter(),
      fakeNoopMetrics,
      fakeMemoryPersistenceMode,
      fakeReceiptProofUrl,
      fakePermissiveCapability,
      fakePermissiveAccess,
      fakeEmptySchedules,
      fakeNoopLog,
      fakeFixedClock
    );
    assert.equal(typeof service.reviewReceipt, "function");
    assert.equal(typeof service.recordPrepayment, "function");
  });
});
