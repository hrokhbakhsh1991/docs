#!/usr/bin/env node
/**
 * Validates apps/web/tests/OWNERS.md and apps/api/test/OWNERS.md cover every centralized test file.
 *
 *   node scripts/check-test-owners.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { globMatches, loadAppOwners } from "./test-owners-core.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

const TEST_FILE =
  /\.(spec|test|unit-spec|integration-spec|integration\.test|e2e-spec|e2e\.spec)\.(ts|tsx|js|jsx)$/i;
const SKIP = new Set([
  "bootstrap.ts",
  "reset-test-database.ts",
  "assign-test-api-port.ts",
  "tenant-test-host.ts",
  "web-session-otp.helper.ts",
  "jwt-test-keys.ts",
  "sign-payments-webhook.ts",
]);

function walkTests(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, ent.name);
    if (ent.isDirectory()) walkTests(abs, out);
    else if (TEST_FILE.test(ent.name) && !SKIP.has(ent.name)) out.push(abs);
  }
  return out;
}

function isCovered(relToTestDir, owners) {
  for (const entry of owners) {
    const tests = /** @type {string[]} */ (entry.tests ?? []);
    if (tests.some((g) => globMatches(g, relToTestDir))) return true;
  }
  return false;
}

const failures = [];

for (const app of ["web", "api"]) {
  const doc = loadAppOwners(REPO_ROOT, app);
  const testRoot = path.join(doc.appRoot, doc.testDir);
  if (!fs.existsSync(testRoot)) continue;

  for (const abs of walkTests(testRoot)) {
    const rel = path.relative(testRoot, abs).replace(/\\/g, "/");
    if (!isCovered(rel, doc.owners)) {
      failures.push(`apps/${app}/${doc.testDir}/${rel}`);
    }
  }
}

if (failures.length) {
  console.error("Test-OWNERS: uncovered centralized test file(s):\n");
  for (const f of failures) {
    console.error(`  ${f}`);
  }
  console.error("\nAdd a tests glob under the owning module in OWNERS.md.");
  process.exit(1);
}

console.log("Test-OWNERS: all centralized test files are mapped in OWNERS.md.");
