#!/usr/bin/env node
/**
 * DEC-084 — terminal timestamps use DB now().
 * @see docs/phase-5/appendices/canonical-terminal-timestamps.md
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPO = path.resolve(ROOT, "../..");
const violations = [];

function read(rel, base = ROOT) {
  return fs.readFileSync(path.join(base, rel), "utf8");
}

function exists(rel, base = ROOT) {
  return fs.existsSync(path.join(base, rel));
}

const docPath = "docs/phase-5/appendices/canonical-terminal-timestamps.md";
if (!exists(docPath, REPO)) {
  violations.push(`${docPath} must exist`);
}

const markDone = read("src/outbox/outbox-mark-done.ts");
if (!markDone.includes("processed_at = now()")) {
  violations.push("outbox-mark-done.ts must set processed_at = now()");
}

const idempotency = read("src/http/http-idempotency.ts");
if (!idempotency.includes("completed_at = now()")) {
  violations.push("http-idempotency.ts must set completed_at = now() on Prisma path");
}

const clockSkew = read("test/4-integration/clock-skew-resilience.spec.ts");
if (!clockSkew.includes("CLK-SKEW-10a")) {
  violations.push("clock-skew-resilience.spec.ts must include CLK-SKEW-10 boundary tests");
}

if (!exists("src/outbox/outbox-mark-done.spec.ts")) {
  violations.push("src/outbox/outbox-mark-done.spec.ts must exist");
}

if (violations.length > 0) {
  console.error("guard-canonical-terminal-timestamps: FAIL");
  for (const v of violations) {
    console.error(`  ${v}`);
  }
  process.exit(1);
}

console.log("guard-canonical-terminal-timestamps: PASS");
