#!/usr/bin/env node
/**
 * SCAL-DEBT-11 / DEC-067 — memory idempotency TTL + LRU bounds (cross-ref DEC-039).
 * @see docs/phase-5/appendices/http-idempotency.md
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GATE = path.join(ROOT, "scripts/phase-3-regression-gate.mjs");
const violations = [];

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

const idempotency = read("src/http/http-idempotency.ts");
if (!idempotency.includes("enforceMemoryIdempotencyBounds")) {
  violations.push("http-idempotency.ts must enforce memory idempotency bounds");
}
if (!idempotency.includes("HTTP_IDEMPOTENCY_MEMORY_MAX_ENTRIES")) {
  violations.push("http-idempotency.ts must read HTTP_IDEMPOTENCY_MEMORY_MAX_ENTRIES");
}
if (!idempotency.includes("HTTP_IDEMPOTENCY_MEMORY_TTL_MS")) {
  violations.push("http-idempotency.ts must read HTTP_IDEMPOTENCY_MEMORY_TTL_MS");
}
if (!idempotency.includes("memoryCompletedOrder")) {
  violations.push("http-idempotency.ts must maintain LRU order for completed entries");
}
if (!idempotency.includes("resetHttpIdempotencyMemoryForTests")) {
  violations.push("http-idempotency.ts must export resetHttpIdempotencyMemoryForTests");
}

const gateSource = fs.readFileSync(GATE, "utf8");
if (!gateSource.includes("http-idempotency.memory.spec.ts")) {
  violations.push("phase-3-regression-gate must run http-idempotency.memory.spec.ts");
}

if (violations.length > 0) {
  console.error("guard-http-idempotency-memory-bounds: FAIL");
  for (const v of violations) {
    console.error(`  ${v}`);
  }
  process.exit(1);
}

console.log("guard-http-idempotency-memory-bounds: PASS");
