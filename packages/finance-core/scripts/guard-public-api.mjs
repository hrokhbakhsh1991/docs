#!/usr/bin/env node
/**
 * finance-core public API freeze — Phase 2.3.3 + PR4.5-B Case subpath.
 * Fails if root barrel uses export *, package exports map drifts, or allowlist mismatches.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = path.resolve(__dirname, "..");
const INDEX_SRC = path.join(PKG_ROOT, "src/index.ts");
const CASE_PUBLIC_SRC = path.join(PKG_ROOT, "src/case/public-api.ts");
const PKG_JSON = path.join(PKG_ROOT, "package.json");
const DIST_INDEX = path.join(PKG_ROOT, "dist/index.js");
const DIST_CASE = path.join(PKG_ROOT, "dist/case/public-api.js");

/** @type {string[]} */
const errors = [];

/** Frozen package.json "exports" keys (plus package.json itself). */
const ALLOWED_EXPORT_KEYS = new Set([
  ".",
  "./ports",
  "./domain",
  "./application",
  "./case",
  "./package.json",
]);

/**
 * Frozen runtime + type export names from package root (alphabetical).
 * Compat aliases included — do not expand without semver decision.
 * Case symbols must NOT appear here (live under ./case only).
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
  "BookingPaymentLifecycleStatus",
  "BookingPaymentLifecycleStatusInput",
  "BookingPaymentMemberOwnershipInput",
  "BookingPaymentRaisePaidInTxInput",
  "BookingPaymentSyncStatus",
  "BookingPaymentSyncStatusInput",
  "IBookingPaymentPort",
  "InstallmentItemStatus",
  "FinanceExceptionE1SourceRow",
  "FinanceExceptionE2SourceRow",
  "ListFinanceExceptionSourcesResult",
  "ListOutstandingBalanceCandidatesResult",
  "ListPendingReceiptsPage",
  "ListPendingReceiptsQuery",
  "OBLIGATION_OVERRIDE_INTAKE_KEY",
  "ObligationOverrideIntake",
  "OutstandingBalanceCandidateRow",
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
  "buildObligationOverrideIntakeValue",
  "buildPaymentScheduleItems",
  "buildPrepaymentDomainEventIds",
  "compileRegistrationInvoice",
  "createFinanceService",
  "filterRowsByRegistrationId",
  "filterRowsByTourId",
  "hashFinanceHttpIdempotencyKey",
  "isZeroObligationMinor",
  "readObligationOverrideFromIntake",
  "reschedulePaymentScheduleItem",
  "waivePaymentScheduleItem",
]);

/** Runtime Case surface symbols that must exist on ./case. */
const REQUIRED_CASE_RUNTIME = [
  "executeFinanceCase",
  "runShadowFinanceCase",
  "interpretFinanceCase",
  "assembleCaseFactSnapshot",
  "assembleFactSnapshot",
  "projectCaseEncounter",
  "knownFact",
  "absentFact",
  "unknownFact",
  "unknownMoneyFacts",
];

/** Must never appear on ./case runtime (rules / Denali / persistence). */
const FORBIDDEN_CASE_RUNTIME =
  /^(resolveOwnership|generatePosture|generateConfidence|evaluateCompleteness|detectConflicts|pickReadingByPrecedence|DEFAULT_CASE_FORBIDS)$/;

const FORBIDDEN_NAME =
  /Prisma|HostFinance|apps\/api|workspace-denali|workspace-finance|\.generated|InMemoryFinance|test\/|fixtures\//;

const indexSrc = fs.readFileSync(INDEX_SRC, "utf8");
if (/export\s+\*\s+from/.test(indexSrc)) {
  errors.push("src/index.ts must not use export * (explicit freeze required)");
}

const casePublicSrc = fs.readFileSync(CASE_PUBLIC_SRC, "utf8");
if (/from\s+["']\.\/rules\//.test(casePublicSrc) || /from\s+["'][^"']*\/rules\//.test(casePublicSrc)) {
  errors.push("src/case/public-api.ts must not import or re-export rules/*");
}
if (/workspace-denali|workspaces\/denali|apps\/api/.test(casePublicSrc)) {
  errors.push("src/case/public-api.ts must not reference Denali or apps/api");
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
    if (
      name === "executeFinanceCase" ||
      name === "runShadowFinanceCase" ||
      name === "interpretFinanceCase"
    ) {
      errors.push(`Case runtime must not appear on package root: ${name}`);
    }
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

if (!fs.existsSync(DIST_CASE)) {
  errors.push("dist/case/public-api.js missing — run package build before guard:public-api");
} else {
  const require = createRequire(import.meta.url);
  const caseMod = require(DIST_CASE);
  const caseNames = Object.keys(caseMod);
  for (const name of REQUIRED_CASE_RUNTIME) {
    if (typeof caseMod[name] === "undefined") {
      errors.push(`./case missing required runtime export: ${name}`);
    }
  }
  for (const name of caseNames) {
    if (FORBIDDEN_CASE_RUNTIME.test(name)) {
      errors.push(`./case must not export rules/internal symbol: ${name}`);
    }
    if (FORBIDDEN_NAME.test(name)) {
      errors.push(`./case forbidden symbol name: ${name}`);
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
console.log(`  root allowlist size: ${ALLOWED_ROOT_EXPORTS.size}`);
console.log("  ./case curated surface present; rules/* not exported");
console.log("  no export *; no Prisma/Host/workspace/generated names");
