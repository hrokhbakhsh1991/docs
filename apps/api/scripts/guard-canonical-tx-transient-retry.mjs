#!/usr/bin/env node
/**
 * DEC-112 — canonical TX whole-transaction transient retry wiring lock.
 * @see docs/phase-5/appendices/canonical-tx-transient-retry.md
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const violations = [];

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

for (const rel of ["src/db/with-transient-tx-retry.ts", "src/db/with-transient-tx-retry.spec.ts"]) {
  if (!fs.existsSync(path.join(ROOT, rel))) {
    violations.push(`${rel} must exist`);
  }
}

const retry = read("src/db/with-transient-tx-retry.ts");
if (!retry.includes("withTransientTxRetry")) {
  violations.push("with-transient-tx-retry.ts must export withTransientTxRetry");
}
if (!retry.includes("isTransientDbError")) {
  violations.push("with-transient-tx-retry.ts must classify via isTransientDbError");
}
if (!retry.includes("CANONICAL_TX_TRANSIENT_RETRY_ATTEMPTS")) {
  violations.push("with-transient-tx-retry.ts must read CANONICAL_TX_TRANSIENT_RETRY_ATTEMPTS");
}

const canonical = read("src/db/with-canonical-transaction.ts");
if (!canonical.includes("withTransientTxRetry")) {
  violations.push("with-canonical-transaction.ts must wrap TX in withTransientTxRetry");
}
if (!canonical.includes("applyTenantRlsSessionVars")) {
  violations.push("with-canonical-transaction.ts must set RLS per transaction attempt");
}

const pkg = read("package.json");
if (!pkg.includes("guard:canonical-tx-transient-retry")) {
  violations.push("package.json must define guard:canonical-tx-transient-retry");
}

if (violations.length > 0) {
  console.error("guard-canonical-tx-transient-retry: FAIL");
  for (const v of violations) {
    console.error(`  ${v}`);
  }
  process.exit(1);
}

console.log("guard-canonical-tx-transient-retry: PASS");
