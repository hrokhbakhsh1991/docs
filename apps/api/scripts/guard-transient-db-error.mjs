#!/usr/bin/env node
/**
 * DEC-094 — transient DB classifier + circuit breaker wiring lock.
 * @see docs/phase-5/appendices/transient-db-error.md
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const violations = [];

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

for (const rel of [
  "src/db/transient-db-error.ts",
  "src/db/db-circuit-breaker.ts",
  "src/db/with-transient-db-guard.ts",
  "src/db/transient-db-error.spec.ts",
]) {
  if (!fs.existsSync(path.join(ROOT, rel))) {
    violations.push(`${rel} must exist`);
  }
}

const classifier = read("src/db/transient-db-error.ts");
if (!classifier.includes("isTransientDbError")) {
  violations.push("transient-db-error.ts must export isTransientDbError");
}
if (!classifier.includes("P1001")) {
  violations.push("transient-db-error.ts must classify P1001");
}

const breaker = read("src/db/db-circuit-breaker.ts");
if (!breaker.includes("assertDbCircuitClosed")) {
  violations.push("db-circuit-breaker.ts must export assertDbCircuitClosed");
}
if (!breaker.includes("db_circuit_open_total")) {
  violations.push("db-circuit-breaker.ts must increment db_circuit_open_total");
}

const rls = read("src/db/with-tenant-rls.ts");
if (!rls.includes("withTransientDbGuard")) {
  violations.push("with-tenant-rls.ts must wrap withTransientDbGuard");
}

const interceptor = read("src/middleware/error-interceptor.ts");
if (!interceptor.includes("DbCircuitOpenError")) {
  violations.push("error-interceptor.ts must handle DbCircuitOpenError");
}
if (!interceptor.includes("Retry-After")) {
  violations.push("error-interceptor.ts must set Retry-After on 503");
}
if (!interceptor.includes("isTransientDbError")) {
  violations.push("error-interceptor.ts must classify transient DB errors");
}

if (violations.length > 0) {
  console.error("guard-transient-db-error: FAIL");
  for (const v of violations) {
    console.error(`  ${v}`);
  }
  process.exit(1);
}

console.log("guard-transient-db-error: PASS");
