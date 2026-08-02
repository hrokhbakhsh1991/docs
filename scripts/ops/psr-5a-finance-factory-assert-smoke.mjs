#!/usr/bin/env node
/**
 * PSR-5a — finance-repository.factory.ts must call assertProductionStorageDriver.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

function fail(msg) {
  console.error(`psr-5a-finance-factory-assert-smoke: FAIL — ${msg}`);
  process.exitCode = 1;
}

const rel = "apps/api/src/workspace-finance/finance-repository.factory.ts";
const text = readFileSync(join(root, rel), "utf8");

if (!/import\s*\{[^}]*assertProductionStorageDriver[^}]*\}\s*from\s*["']\.\.\/storage\/production-storage-driver-assert["']/.test(text)) {
  fail("must import assertProductionStorageDriver from production-storage-driver-assert");
}
if (!text.includes("assertProductionStorageDriver()")) {
  fail("createFinanceRepository must call assertProductionStorageDriver()");
}

// Call must precede memory branch construction
const assertIdx = text.indexOf("assertProductionStorageDriver()");
const memIdx = text.indexOf('resolveStorageDriver() === "memory"');
if (assertIdx < 0 || memIdx < 0 || assertIdx > memIdx) {
  fail("assertProductionStorageDriver() must run before memory branch selection");
}

if (process.exitCode) process.exit(process.exitCode);
console.log("psr-5a-finance-factory-assert-smoke: OK — finance factory asserts production storage");
