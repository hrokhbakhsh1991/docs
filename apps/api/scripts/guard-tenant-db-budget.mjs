#!/usr/bin/env node
/**
 * SCAL-DEBT-01 / DEC-055 — app-pool TX paths must use tenant DB budget semaphore.
 * @see docs/phase-5/appendices/connection-budget.md
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const violations = [];

for (const rel of ["src/db/with-tenant-rls.ts", "src/db/with-canonical-transaction.ts"]) {
  const source = fs.readFileSync(path.join(ROOT, rel), "utf8");
  if (!source.includes("withTenantDbBudget")) {
    violations.push(`${rel} must wrap transactions with withTenantDbBudget`);
  }
}

const budgetPath = path.join(ROOT, "src/db/tenant-connection-budget.ts");
const budgetSource = fs.readFileSync(budgetPath, "utf8");
if (!budgetSource.includes("TenantDbBudgetExceededError")) {
  violations.push("tenant-connection-budget.ts must export TenantDbBudgetExceededError");
}
if (!budgetSource.includes("resolveTenantMaxConcurrentDbOps")) {
  violations.push("tenant-connection-budget.ts must read TENANT_MAX_CONCURRENT_DB_OPS");
}

const interceptorSource = fs.readFileSync(
  path.join(ROOT, "src/middleware/error-interceptor.ts"),
  "utf8"
);
if (!interceptorSource.includes("isTenantDbBudgetExceededError")) {
  violations.push("error-interceptor.ts must map TenantDbBudgetExceededError to 503");
}

if (violations.length > 0) {
  console.error("guard-tenant-db-budget: FAIL");
  for (const v of violations) {
    console.error(`  ${v}`);
  }
  process.exit(1);
}

console.log("guard-tenant-db-budget: PASS");
