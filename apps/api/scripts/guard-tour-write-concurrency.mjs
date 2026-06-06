#!/usr/bin/env node
/**
 * SCAL-DEBT-09 / DEC-064 — POST /tours must cap concurrent in-flight creates.
 * @see docs/phase-5/appendices/tour-write-concurrency.md
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const violations = [];

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

const budget = read("src/http/tour-write-concurrency-budget.ts");
if (!budget.includes("TourWriteConcurrencyExceededError")) {
  violations.push("tour-write-concurrency-budget.ts must export TourWriteConcurrencyExceededError");
}
if (!budget.includes("resolveTenantMaxConcurrentTourWrites")) {
  violations.push("tour-write-concurrency-budget.ts must read TENANT_MAX_CONCURRENT_TOUR_WRITES");
}

const bind = read("src/http/bind-request-context.ts");
if (!bind.includes("withTourWriteConcurrencyBudget")) {
  violations.push("bind-request-context.ts must use withTourWriteConcurrencyBudget");
}
if (!bind.includes("tourWriteConcurrency")) {
  violations.push("bind-request-context.ts must expose tourWriteConcurrency option");
}

const routes = read("src/tours/tours.routes.ts");
if (!routes.includes("tourWriteConcurrency: true")) {
  violations.push("tours.routes.ts must enable tourWriteConcurrency on handleCreateTour");
}

const interceptor = read("src/middleware/error-interceptor.ts");
if (!interceptor.includes("isTourWriteConcurrencyExceededError")) {
  violations.push("error-interceptor.ts must map TourWriteConcurrencyExceededError to 429");
}

if (violations.length > 0) {
  console.error("guard-tour-write-concurrency: FAIL");
  for (const v of violations) {
    console.error(`  ${v}`);
  }
  process.exit(1);
}

console.log("guard-tour-write-concurrency: PASS");
