#!/usr/bin/env node
/**
 * TRACE-LOST-03 / DEC-046 — tour create outbox must store HTTP trace correlation.
 * @see docs/phase-5/appendices/IMPLEMENTATION-DECISIONS.md DEC-046
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ATOMIC_PERSIST = path.join(ROOT, "src/canonical/atomic-canonical-tour-persist.ts");

const text = fs.readFileSync(ATOMIC_PERSIST, "utf8");
const violations = [];

if (!text.includes("getActiveTraceId")) {
  violations.push("atomic-canonical-tour-persist.ts: must import getActiveTraceId");
}
if (!/correlationId:\s*getActiveTraceId\(\)/.test(text)) {
  violations.push(
    "atomic-canonical-tour-persist.ts: enqueueOutboxEvent must pass correlationId: getActiveTraceId()"
  );
}

if (violations.length > 0) {
  console.error("guard-outbox-http-correlation: FAIL");
  for (const v of violations) {
    console.error(`  ${v}`);
  }
  process.exit(1);
}

console.log("guard-outbox-http-correlation: PASS");
