#!/usr/bin/env node
/**
 * DEC-077 / Phase 4 step 7 — canonical TX must use one DB now() snapshot.
 * @see docs/phase-5/appendices/canonical-transaction-now.md
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const violations = [];

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

const atomic = read("src/canonical/atomic-canonical-tour-persist.ts");
if (!atomic.includes("readCanonicalTransactionNow")) {
  violations.push("atomic-canonical-tour-persist.ts must call readCanonicalTransactionNow");
}
if (/const createdAt = new Date\(\)/.test(atomic)) {
  violations.push(
    "atomic-canonical-tour-persist.ts must not assign tour createdAt from app new Date()"
  );
}
if (!/createdAt:\s*txNow/.test(atomic)) {
  violations.push(
    "atomic-canonical-tour-persist.ts must pass txNow to tour, audit, and outbox writes"
  );
}

const audit = read("src/audit/audit-logger.ts");
if (!audit.includes("readonly createdAt?: Date")) {
  violations.push("audit-logger.ts must accept optional createdAt on appendAuditEvent");
}

const enqueue = read("src/outbox/enqueue-domain-event.ts");
if (!enqueue.includes("readonly createdAt?: Date")) {
  violations.push("enqueue-domain-event.ts must accept optional createdAt on enqueueOutboxEvent");
}
if (!enqueue.includes("createdAt: input.createdAt")) {
  violations.push("enqueue-domain-event.ts must persist explicit createdAt when provided");
}

const nowModule = read("src/db/canonical-transaction-now.ts");
if (!nowModule.includes("$queryRaw")) {
  violations.push("canonical-transaction-now.ts must read Postgres now() via $queryRaw");
}

for (const spec of [
  "src/db/canonical-transaction-now.spec.ts",
  "src/canonical/canonical-timestamp-unify.spec.ts",
]) {
  if (!fs.existsSync(path.join(ROOT, spec))) {
    violations.push(`${spec} must exist`);
  }
}

if (violations.length > 0) {
  console.error("guard-canonical-transaction-now: FAIL");
  for (const v of violations) {
    console.error(`  ${v}`);
  }
  process.exit(1);
}

console.log("guard-canonical-transaction-now: PASS");
