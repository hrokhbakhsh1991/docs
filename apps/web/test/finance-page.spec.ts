/**
 * Phase 9.7 — finance command center web surface (REQ-P9-071 · ADV-P9-09).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { financeBookingHref } from "../src/finance/finance-booking-href";
import {
  FINANCE_COMMAND_CENTER_TABS,
  listVisibleFinanceTabs,
  parseFinanceTab,
  resolveFinanceOpsCapabilityForHub,
} from "../src/finance/finance-nav-access";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DENALI_OPS = resolveFinanceOpsCapabilityForHub(null, "denali");
assert.ok(DENALI_OPS !== null, "denali must expose finance ops capability");
const DENALI_VISIBLE = listVisibleFinanceTabs(DENALI_OPS);

describe("finance-page.spec.ts — Phase 9.7", () => {
  it("WEB-9.7-03 command center exposes R1 + R2 tab catalog", () => {
    assert.deepEqual(FINANCE_COMMAND_CENTER_TABS, [
      "overview",
      "payments",
      "receipts",
      "prepayments",
      "installments",
      "ledger",
    ]);
    assert.equal(parseFinanceTab(undefined, DENALI_VISIBLE), "overview");
    assert.equal(parseFinanceTab("receipts", DENALI_VISIBLE), "receipts");
    assert.equal(parseFinanceTab("prepayments", DENALI_VISIBLE), "prepayments");
    assert.equal(parseFinanceTab("unknown", DENALI_VISIBLE), "overview");
  });

  it("WEB-9.7-04 tab shell uses client router.replace (no hard <a href>)", () => {
    const shell = readFileSync(
      resolve(WEB_ROOT, "app/(app)/finance/finance-command-center.tsx"),
      "utf8"
    );
    assert.match(shell, /useSearchParams/);
    assert.match(shell, /router\.replace/);
    assert.match(shell, /type="button"/);
    assert.doesNotMatch(shell, /href=\{`\/finance\?tab=/);
  });

  it("WEB-9.7-05 default manifest shows installments tab (Phase D)", () => {
    const visible = DENALI_VISIBLE;
    assert.ok(visible.includes("installments"));
    assert.ok(visible.includes("payments"));
    assert.ok(visible.includes("ledger"));
    assert.equal(parseFinanceTab("installments", visible), "installments");
  });

  it("WEB-9.7-06 financeBookingHref deep-links command center bookingId", () => {
    const id = "00000000-0000-4000-8000-000000000099";
    assert.equal(financeBookingHref(id), `/bookings?bookingId=${encodeURIComponent(id)}`);
  });

  it("WEB-9.7-13 registration link prefers human label over UUID", () => {
    const link = readFileSync(
      resolve(WEB_ROOT, "src/finance/finance-registration-link.tsx"),
      "utf8"
    );
    assert.match(link, /openBooking/);
    assert.match(link, /title=\{id\}/);
    assert.doesNotMatch(link, /id\.slice\(0,\s*8\)/);
    const identity = readFileSync(
      resolve(WEB_ROOT, "src/finance/finance-registration-identity.tsx"),
      "utf8"
    );
    assert.match(identity, /memberDisplayName/);
    assert.match(identity, /tourTitle/);
  });

  it("WEB-9.7-07 Phase A: registration links + advanced receipt + audit framing", () => {
    const payments = readFileSync(
      resolve(WEB_ROOT, "src/finance/finance-payments-panel.tsx"),
      "utf8"
    );
    assert.match(payments, /FinanceRegistrationIdentity|FinanceRegistrationLink/);
    assert.match(payments, /finance-submit-receipt-advanced/);
    const ledger = readFileSync(resolve(WEB_ROOT, "src/finance/finance-ledger-panel.tsx"), "utf8");
    assert.match(ledger, /data-finance-audit-panel/);
    assert.match(ledger, /auditSubtitle/);
    const shell = readFileSync(
      resolve(WEB_ROOT, "app/(app)/finance/finance-command-center.tsx"),
      "utf8"
    );
    assert.match(shell, /listVisibleFinanceTabs/);
    assert.match(shell, /finance-tab-guidance/);
  });

  it("WEB-9.7-08 Phase B: registration context parse + filter query helper", () => {
    const ctx = readFileSync(
      resolve(WEB_ROOT, "src/finance/finance-registration-context.ts"),
      "utf8"
    );
    assert.match(ctx, /parseFinanceRegistrationContext/);
    assert.match(ctx, /withFinanceRegistrationQuery/);
    const paymentsLogic = readFileSync(
      resolve(WEB_ROOT, "src/finance/finance-payments-logic.ts"),
      "utf8"
    );
    assert.match(paymentsLogic, /registrationContext/);
    const shell = readFileSync(
      resolve(WEB_ROOT, "app/(app)/finance/finance-command-center.tsx"),
      "utf8"
    );
    assert.match(shell, /finance-registration-filter/);
  });

  it("WEB-9.7-09 Phase C: picker uses bookings BFF + decision guide + status filter", () => {
    const picker = readFileSync(
      resolve(WEB_ROOT, "src/finance/finance-registration-picker.tsx"),
      "utf8"
    );
    assert.match(picker, /\/api\/bookings/);
    assert.match(picker, /view=ops/);
    assert.doesNotMatch(picker, /\/api\/finance\/search/);
    const invoiceCard = readFileSync(
      resolve(WEB_ROOT, "src/finance/finance-invoice-balance-card.tsx"),
      "utf8"
    );
    assert.match(invoiceCard, /buildInvoiceLookupPath/);
    const payments = readFileSync(
      resolve(WEB_ROOT, "src/finance/finance-payments-panel.tsx"),
      "utf8"
    );
    assert.match(payments, /FinanceRegistrationPicker/);
    assert.match(payments, /finance-payments-status-filter/);
    assert.match(payments, /listScopeHint/);
    const shell = readFileSync(
      resolve(WEB_ROOT, "app/(app)/finance/finance-command-center.tsx"),
      "utf8"
    );
    assert.match(shell, /finance-decision-guide/);
  });

  it("WEB-9.7-10 Phase D: installments board has no waive/record stubs", () => {
    const panel = readFileSync(
      resolve(WEB_ROOT, "src/finance/finance-installments-panel.tsx"),
      "utf8"
    );
    assert.match(panel, /finance-installments-semantics/);
    assert.match(panel, /partialHint/);
    assert.match(panel, /actionsDeferred/);
    assert.match(panel, /schedules\/generate/);
    assert.match(panel, /installmentDefaults\?\.enabled/);
    assert.doesNotMatch(panel, /waive|recordPayment|onWaive|onRecordInstallment/i);
  });

  it("WEB-9.7-11 Phase E: overview links triage + attention samples helper", () => {
    const overview = readFileSync(
      resolve(WEB_ROOT, "src/finance/finance-overview-panel.tsx"),
      "utf8"
    );
    const reportsLogic = readFileSync(
      resolve(WEB_ROOT, "src/finance/finance-reports-logic.ts"),
      "utf8"
    );
    assert.match(overview, /\/settings\/reconciliation-triage/);
    assert.match(overview, /FINANCE_OVERVIEW_TEST_IDS\.triageLink/);
    assert.match(overview, /buildFinanceAttentionSamples/);
    assert.match(overview, /FINANCE_OVERVIEW_TEST_IDS\.attentionList/);
    assert.doesNotMatch(overview, /reconciliation-triage-client/);
    assert.match(reportsLogic, /finance-open-reconciliation-triage/);
    assert.match(reportsLogic, /finance-attention-samples/);
  });

  it("WEB-9.7-12 / P1.10.1 ops panels use FinanceOpsCapability; no Denali hard-import", () => {
    const ops = readFileSync(resolve(WEB_ROOT, "src/finance/finance-ops-panels.ts"), "utf8");
    const contract = readFileSync(
      resolve(WEB_ROOT, "src/finance/finance-ops-capability-contract.ts"),
      "utf8"
    );
    const enablement = readFileSync(resolve(WEB_ROOT, "src/finance/finance-nav-enablement.ts"), "utf8");
    const access = readFileSync(resolve(WEB_ROOT, "src/finance/finance-nav-access.ts"), "utf8");
    const dashboard = readFileSync(
      resolve(WEB_ROOT, "src/finance/finance-dashboard-widget-logic.ts"),
      "utf8"
    );
    const operatorNav = readFileSync(resolve(WEB_ROOT, "src/admin/shell/resolve-operator-nav.ts"), "utf8");
    const commandCenter = readFileSync(
      resolve(WEB_ROOT, "app/(app)/finance/finance-command-center.tsx"),
      "utf8"
    );
    assert.match(contract, /export type FinanceOpsCapability/);
    assert.doesNotMatch(ops, /@app-tour\/workspace-denali/);
    assert.match(ops, /workspace-finance-ops-bindings/);
    assert.match(ops, /resolveFinanceOpsCapabilityForHub/);
    assert.match(ops, /FinanceOpsCapability \| null/);
    assert.match(commandCenter, /session\.pluginId/);
    assert.match(commandCenter, /resolveFinanceOpsCapabilityForHub/);
    assert.match(commandCenter, /capability === null/);
    assert.match(commandCenter, /return null/);
    assert.doesNotMatch(enablement, /workspace-denali/);
    assert.match(enablement, /workspace-finance-nav-bindings/);
    assert.doesNotMatch(access, /workspace-denali/);
    assert.match(access, /finance-ops-panels/);
    assert.match(dashboard, /finance-nav-enablement/);
    assert.doesNotMatch(dashboard, /workspace-denali|finance-ops-panels|finance-nav-access/);
    assert.match(operatorNav, /finance-nav-enablement/);
    assert.doesNotMatch(operatorNav, /workspace-denali|finance-ops-panels/);
  });

  it("WEB-P1.10.1-01 workspace without finance ops capability resolves to null (render nothing)", () => {
    assert.equal(resolveFinanceOpsCapabilityForHub(null, "urban"), null);
    assert.equal(resolveFinanceOpsCapabilityForHub(null, "starter"), null);
    assert.equal(resolveFinanceOpsCapabilityForHub(null, "finance-ws2"), null);
    assert.equal(resolveFinanceOpsCapabilityForHub(null, ""), null);
    assert.ok(resolveFinanceOpsCapabilityForHub(null, "denali") !== null);
  });
});
