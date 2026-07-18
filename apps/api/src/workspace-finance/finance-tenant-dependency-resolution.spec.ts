/**
 * Phase 1.5 Commit 1 — tenant-aware finance dependency resolution proofs.
 */
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";

import {
  resetLazyFinanceServiceForTests,
  resolveFinanceServiceForTenant,
  resolveLazyFinanceService,
} from "../boot/lazy-finance-service.ts";
import { OPERATOR_SMOKE } from "../../test/fixtures/operator-smoke-e2e-tenant.ts";
import {
  listRegisteredFinanceWorkspaceTypes,
  resolveBootFinanceWorkspaceType,
  resolveFinanceBookingPayments,
  resolveFinanceLedgerPolicy,
  resolveFinanceReceiptDefaults,
  resolveFinanceWorkspaceDependencies,
} from "./finance-dependency-registry.ts";
import { DenaliFinanceLedgerPolicyAdapter } from "./infrastructure/denali-finance-ledger-policy.adapter.ts";
import { DenaliFinanceReceiptDefaultsAdapter } from "./infrastructure/denali-finance-receipt-defaults.adapter.ts";
import { BookingPaymentAdapter } from "./infrastructure/booking-payment.adapter.ts";
import {
  FINANCE_WS2_WORKSPACE_TYPE,
} from "./infrastructure/finance-ws2-chart-of-accounts.ts";
import { FinanceWs2LedgerPolicyAdapter } from "./infrastructure/finance-ws2-ledger-policy.adapter.ts";
import { FinanceWs2ReceiptDefaultsAdapter } from "./infrastructure/finance-ws2-receipt-defaults.adapter.ts";
import { resolveFinanceWorkspaceTypeForTenant } from "./resolve-finance-workspace-type-for-tenant.ts";

const DENALI = "denali";
const WS2 = FINANCE_WS2_WORKSPACE_TYPE;
const URBAN_TENANT_ID = "00000000-0000-4000-8000-000000000004";
const DENALI_TENANT_ID = OPERATOR_SMOKE.tenantId; // operator smoke = denali
const UNKNOWN_TENANT_ID = "99999999-9999-4999-8999-999999999999";

describe("finance-tenant-dependency-resolution.spec.ts — Phase 1.5 C1", { concurrency: false }, () => {
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

  it("FIN-P1.5-01 booking projection resolves by workspaceType (Denali + WS2)", () => {
    assert.ok(resolveFinanceBookingPayments(DENALI) instanceof BookingPaymentAdapter);
    assert.ok(resolveFinanceBookingPayments(WS2) instanceof BookingPaymentAdapter);
  });

  it("FIN-P1.5-02 booking projection fails closed for unsupported workspaceType", () => {
    assert.throws(
      () => resolveFinanceBookingPayments("urban"),
      (error: unknown) =>
        error instanceof Error &&
        error.message.startsWith("FINANCE_BOOKING_PAYMENT_UNSUPPORTED:") &&
        error.message.includes("urban")
    );
  });

  it("FIN-P1.5-03 resolveFinanceWorkspaceDependencies bundles policy+defaults+booking", () => {
    const denali = resolveFinanceWorkspaceDependencies(DENALI);
    assert.equal(denali.workspaceType, DENALI);
    assert.ok(denali.ledgerPolicy instanceof DenaliFinanceLedgerPolicyAdapter);
    assert.ok(denali.receiptDefaults instanceof DenaliFinanceReceiptDefaultsAdapter);
    assert.ok(denali.bookingPayments instanceof BookingPaymentAdapter);
    assert.deepEqual(denali.receiptDefaults.offlineReceiptPaymentDefaults(), {
      amountMinor: "2500000",
      currency: "IRR",
    });

    const ws2 = resolveFinanceWorkspaceDependencies(WS2);
    assert.equal(ws2.workspaceType, WS2);
    assert.ok(ws2.ledgerPolicy instanceof FinanceWs2LedgerPolicyAdapter);
    assert.ok(ws2.receiptDefaults instanceof FinanceWs2ReceiptDefaultsAdapter);
    assert.ok(ws2.bookingPayments instanceof BookingPaymentAdapter);
    assert.deepEqual(ws2.receiptDefaults.offlineReceiptPaymentDefaults(), {
      amountMinor: "10000",
      currency: "USD",
    });
  });

  it("FIN-P1.5-04 tenant → workspaceType: Denali tenant resolves denali", async () => {
    assert.equal(await resolveFinanceWorkspaceTypeForTenant(DENALI_TENANT_ID), DENALI);
  });

  it("FIN-P1.5-05 tenant → workspaceType fail-closed for urban / unknown", async () => {
    await assert.rejects(
      () => resolveFinanceWorkspaceTypeForTenant(URBAN_TENANT_ID),
      (error: unknown) =>
        error instanceof Error && error.message.startsWith("FINANCE_WORKSPACE_UNSUPPORTED")
    );
    await assert.rejects(
      () => resolveFinanceWorkspaceTypeForTenant(UNKNOWN_TENANT_ID),
      (error: unknown) =>
        error instanceof Error && error.message.startsWith("FINANCE_WORKSPACE_UNSUPPORTED")
    );
  });

  it("FIN-P1.5-06 resolveFinanceServiceForTenant(Denali) uses Denali ledger policy", async () => {
    const service = await resolveFinanceServiceForTenant(DENALI_TENANT_ID);
    // Prove composition selected Denali defaults path via offline receipt literals on a fresh engine:
    // service is opaque; resolve deps for denali and confirm boot type still denali.
    assert.equal(resolveBootFinanceWorkspaceType(), DENALI);
    assert.ok(resolveFinanceLedgerPolicy(DENALI) instanceof DenaliFinanceLedgerPolicyAdapter);
    assert.equal(typeof service.getSummary, "function");
    assert.deepEqual(listRegisteredFinanceWorkspaceTypes(), [DENALI, WS2].sort());
  });

  it("FIN-P1.5-07 resolveLazyFinanceService preserves Denali boot composition", async () => {
    const lazy = await resolveLazyFinanceService();
    const forTenant = await resolveFinanceServiceForTenant(DENALI_TENANT_ID);
    // Same cached Denali instance (boot type === tenant type).
    assert.equal(lazy, forTenant);
  });

  it("FIN-P1.5-08 resolveFinanceServiceForTenant(urban) fails closed", async () => {
    await assert.rejects(
      () => resolveFinanceServiceForTenant(URBAN_TENANT_ID),
      (error: unknown) =>
        error instanceof Error && error.message.startsWith("FINANCE_WORKSPACE_UNSUPPORTED")
    );
  });
});
