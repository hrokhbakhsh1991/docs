#!/usr/bin/env node
/**
 * SCAL-DEBT-05 / DEC-060 — production storage driver fail-closed (cross-ref DEC-GAP-03).
 * @see docs/phase-4/appendices/storage-driver-truth.md
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

const createTourStorage = read("src/storage/create-tour-storage.ts");
if (!createTourStorage.includes("assertProductionStorageDriver")) {
  violations.push("create-tour-storage.ts must export assertProductionStorageDriver");
}
if (!createTourStorage.includes("PRODUCTION_STORAGE_DRIVER_FORBIDDEN")) {
  violations.push("create-tour-storage.ts must define PRODUCTION_STORAGE_DRIVER_FORBIDDEN");
}
if (!createTourStorage.includes("createTourStorageRepository")) {
  violations.push("create-tour-storage.ts must call assertProductionStorageDriver in factory");
}

const productionRuntime = read("src/server/production-runtime-env.ts");
if (!productionRuntime.includes("assertProductionStorageDriver()")) {
  violations.push("production-runtime-env.ts must call assertProductionStorageDriver()");
}

const mainTs = read("src/main.ts");
if (!mainTs.includes("assertProductionRuntimeIntegrity()")) {
  violations.push("main.ts must call assertProductionRuntimeIntegrity() at boot");
}

const gateSource = fs.readFileSync(GATE, "utf8");
if (!gateSource.includes("create-tour-storage.spec.ts")) {
  violations.push("phase-3-regression-gate must run create-tour-storage.spec.ts");
}
if (!gateSource.includes("forensic-storage-driver.spec.ts")) {
  violations.push("phase-3-regression-gate must run forensic-storage-driver.spec.ts");
}

if (violations.length > 0) {
  console.error("guard:production-storage-driver: FAIL");
  for (const v of violations) {
    console.error(`  ${v}`);
  }
  process.exit(1);
}

console.log("guard:production-storage-driver: PASS");
