#!/usr/bin/env node
/**
 * AUDIT-GAP-01 / DEC-045 — production forensic storage boot chain + audit call-site lock.
 * @see docs/phase-5/appendices/IMPLEMENTATION-DECISIONS.md DEC-045
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src");

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

const violations = [];

const createTourStorage = read("src/storage/create-tour-storage.ts");
if (!createTourStorage.includes("assertProductionStorageDriver")) {
  violations.push("create-tour-storage.ts: missing assertProductionStorageDriver");
}
if (!createTourStorage.includes("PRODUCTION_STORAGE_DRIVER_FORBIDDEN")) {
  violations.push("create-tour-storage.ts: missing PRODUCTION_STORAGE_DRIVER_FORBIDDEN");
}
if (!createTourStorage.includes("isForensicStorageDriver")) {
  violations.push("create-tour-storage.ts: missing isForensicStorageDriver export");
}

const productionRuntime = read("src/server/production-runtime-env.ts");
if (!productionRuntime.includes("assertProductionStorageDriver()")) {
  violations.push("production-runtime-env.ts: must call assertProductionStorageDriver()");
}

const mainTs = read("src/main.ts");
if (!mainTs.includes("assertProductionRuntimeIntegrity()")) {
  violations.push("main.ts: must call assertProductionRuntimeIntegrity() at boot");
}

const AUDIT_CALL_SITES = new Set([
  "src/canonical/atomic-canonical-tour-persist.ts",
  "src/internal/provisioning.service.ts", // DEC-127 TENANT_PROVISIONED in admin TX
  "src/workspace-wallet/wallet-audit-writer.ts",
]);

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) {
    return out;
  }
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "node_modules" || ent.name === "dist") {
        continue;
      }
      walk(p, out);
    } else if (ent.name.endsWith(".ts") && !ent.name.endsWith(".spec.ts")) {
      out.push(p);
    }
  }
  return out;
}

for (const file of walk(SRC)) {
  const rel = path.relative(ROOT, file).replaceAll("\\", "/");
  if (rel === "src/audit/audit-logger.ts") {
    continue;
  }
  const text = fs.readFileSync(file, "utf8");
  if (/\bappendAuditEvent\b/.test(text) && !AUDIT_CALL_SITES.has(rel)) {
    violations.push(
      `${rel}: appendAuditEvent only allowed in audit-logger.ts (definition) and ${[...AUDIT_CALL_SITES].join(", ")}`
    );
  }
}

if (violations.length > 0) {
  console.error("guard-forensic-storage-production: FAIL");
  for (const v of violations) {
    console.error(`  ${v}`);
  }
  process.exit(1);
}

console.log("guard-forensic-storage-production: PASS");
