/**
 * Phase 1.9.1 / composition-root mandatory — FinanceService must not construct infrastructure.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
          display
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
          undefined as never
        ),
      /FINANCE_SERVICE_DEP_REQUIRED: registrationDisplay/
    );
    assert.throws(
      () => createFinanceRepository(undefined as never),
      /FINANCE_REPOSITORY_BOOKING_PAYMENTS_REQUIRED/
    );

    const serviceSrc = readFileSync(
      resolve(REPO_ROOT, "apps/api/src/workspace-finance/finance.service.ts"),
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

    const factorySrc = readFileSync(
      resolve(REPO_ROOT, "apps/api/src/workspace-finance/finance-repository.factory.ts"),
      "utf8"
    );
    assert.doesNotMatch(factorySrc, /BookingPaymentAdapter|=\s*new Booking/);
  });

  it("FIN-DI-02 registry-created service works via composition root", async () => {
    resetLazyFinanceServiceForTests();
    resetFinanceRepositoryForTests();

    const deps = resolveFinanceWorkspaceDependencies(DENALI);
    assert.ok(deps.ledgerPolicy instanceof DenaliFinanceLedgerPolicyAdapter);
    assert.ok(deps.receiptDefaults instanceof DenaliFinanceReceiptDefaultsAdapter);
    assert.ok(deps.bookingPayments instanceof BookingPaymentAdapter);

    const repository = createFinanceRepository(deps.bookingPayments);
    const display = new BookingRegistrationDisplayAdapter();
    const service = createFinanceService(
      deps.ledgerPolicy,
      repository,
      deps.bookingPayments,
      deps.receiptDefaults,
      display
    );
    assert.equal(typeof service.getSummary, "function");

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
      new BookingRegistrationDisplayAdapter()
    );
    assert.equal(typeof service.reviewReceipt, "function");
    assert.equal(typeof service.recordPrepayment, "function");
  });
});
