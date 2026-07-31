#!/usr/bin/env node
/**
 * finance-core public API freeze — Phase 2.3.3.
 * Fails if root barrel uses export *, package exports map drifts, or allowlist mismatches.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = path.resolve(__dirname, "..");
const INDEX_SRC = path.join(PKG_ROOT, "src/index.ts");
const PKG_JSON = path.join(PKG_ROOT, "package.json");
const DIST_INDEX = path.join(PKG_ROOT, "dist/index.js");

/** @type {string[]} */
const errors = [];

/** Frozen package.json "exports" keys (plus package.json itself). */
const ALLOWED_EXPORT_KEYS = new Set([".", "./ports", "./domain", "./application", "./package.json"]);

/**
 * Frozen runtime + type export names from package root (alphabetical).
 * Compat aliases included — do not expand without semver decision.
 */
const ALLOWED_ROOT_EXPORTS = new Set([
  "AmbientTenantTx",
  "ApproveManualReceiptAtomicInput",
  "ApproveManualReceiptAtomicResult",
  "BookingPaymentMemberOwnershipInput",
  "BookingPaymentRaisePaidInTxInput",
  "BookingPaymentSyncStatus",
  "BookingPaymentSyncStatusInput",
  "BuildPaymentCaptureJournalInput",
  "BuildPrepaymentJournalInput",
  "BuildTourCreatedPaidJournalInput",
  "CompileInvoiceBalancesInput",
  "CreatePaymentInput",
  "CreateReceiptInput",
  "FinanceAccessPort",
  "FinanceActorContext",
  "FinanceActorRole",
  "FinanceApproveMetricResult",
  "FinanceAuthorizationPort",
  "FinanceAuthzPort",
  "FinanceCapabilityPort",
  "FinanceClockPort",
  "FinanceLedgerCaptureMetricResult",
  "FinanceLatencyOperation",
  "FinanceLedgerCapturePlan",
  "FinanceLedgerJournalLine",
  "FinanceLedgerOutboxRow",
  "FinanceLedgerPolicyPort",
  "FinanceLedgerPostingSide",
  "FinanceLogPort",
  "FinanceLoggerPort",
  "FinanceMembershipStatus",
  "FinanceMetricName",
  "FinanceMetricsPort",
  "FINANCE_METRIC",
  "FINANCE_LATENCY_BUDGET_MS",
  "FinanceOfflineReceiptDefaults",
  "FinanceOpenPaymentRow",
  "FinancePaymentRow",
  "FinancePersistenceModePort",
  "FinancePrepaymentListRow",
  "FinanceReceiptDefaultsPort",
  "FinanceReceiptProofSignedUrlInput",
  "FinanceReceiptProofUrlPort",
  "FinanceReceiptRow",
  "FinanceRegistrationContext",
  "FinanceRegistrationDisplay",
  "FinanceRepositoryPort",
  "FinanceSchedulePort",
  "FinanceService",
  "FinanceStorageDriverPort",
  "FinanceStoragePort",
  "FinanceSummaryRow",
  "FinanceTourPaymentAggregateRow",
  "FinanceTransaction",
  "FinanceTransactionPort",
  "FinanceWorkspaceGateResult",
  "GenerateScheduleTemplate",
  "IBookingPaymentPort",
  "InstallmentItemStatus",
  "PaymentScheduleItem",
  "PrepaymentBookingSyncDegradedRow",
  "PrepaymentRecord",
  "ReceiptProofSignedUrlInput",
  "ReceiptProofStoragePort",
  "RecordPrepaymentAtomicInput",
  "RecordPrepaymentAtomicResult",
  "RegistrationDisplayPort",
  "RegistrationInvoiceFacts",
  "RegistrationInvoiceReadModel",
  "UpdateReceiptReviewInput",
  "attachFinanceRegistrationContext",
  "buildPaymentScheduleItems",
  "buildPrepaymentDomainEventIds",
  "compileRegistrationInvoice",
  "createFinanceService",
  "filterRowsByRegistrationId",
  "filterRowsByTourId",
  "hashFinanceHttpIdempotencyKey",
]);

const FORBIDDEN_NAME =
  /Prisma|HostFinance|apps\/api|workspace-denali|workspace-finance|\.generated|InMemoryFinance|test\/|fixtures\//;

const indexSrc = fs.readFileSync(INDEX_SRC, "utf8");
if (/export\s+\*\s+from/.test(indexSrc)) {
  errors.push("src/index.ts must not use export * (explicit freeze required)");
}

const pkg = JSON.parse(fs.readFileSync(PKG_JSON, "utf8"));
const exportKeys = Object.keys(pkg.exports ?? {});
for (const key of exportKeys) {
  if (!ALLOWED_EXPORT_KEYS.has(key)) {
    errors.push(`package.json exports has unexpected key: ${key}`);
  }
}
for (const key of ALLOWED_EXPORT_KEYS) {
  if (!exportKeys.includes(key)) {
    errors.push(`package.json exports missing required key: ${key}`);
  }
}

if (!fs.existsSync(DIST_INDEX)) {
  errors.push("dist/index.js missing — run package build before guard:public-api");
} else {
  const require = createRequire(import.meta.url);
  const mod = require(DIST_INDEX);
  const names = Object.keys(mod).sort();
  for (const name of names) {
    if (!ALLOWED_ROOT_EXPORTS.has(name)) {
      errors.push(`unexpected root runtime export: ${name}`);
    }
    if (FORBIDDEN_NAME.test(name)) {
      errors.push(`forbidden symbol name on public API: ${name}`);
    }
  }
  for (const name of ALLOWED_ROOT_EXPORTS) {
    // Type-only exports are erased at runtime — only assert runtime values exist when present on mod
    // Runtime values that must exist:
  }
  for (const runtime of [
    "FinanceService",
    "createFinanceService",
    "hashFinanceHttpIdempotencyKey",
    "buildPrepaymentDomainEventIds",
    "buildPaymentScheduleItems",
    "compileRegistrationInvoice",
    "attachFinanceRegistrationContext",
    "filterRowsByRegistrationId",
    "filterRowsByTourId",
  ]) {
    if (typeof mod[runtime] === "undefined") {
      errors.push(`missing required runtime export: ${runtime}`);
    }
  }
}

if (errors.length > 0) {
  console.error("guard-finance-core-public-api: FAIL");
  for (const e of errors) {
    console.error(`  - ${e}`);
  }
  process.exit(1);
}

console.log("guard-finance-core-public-api: PASS");
console.log(`  package exports: ${[...ALLOWED_EXPORT_KEYS].join(", ")}`);
console.log(`  allowlist size: ${ALLOWED_ROOT_EXPORTS.size}`);
console.log("  no export *; no Prisma/Host/workspace/generated names");
