#!/usr/bin/env node
/**
 * AUDIT-GAP-02 / DEC-047 — PATCH /tours must append TOUR_UPDATED in atomic TX.
 * @see docs/phase-5/appendices/IMPLEMENTATION-DECISIONS.md DEC-047
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

const violations = [];

const auditLogger = read("src/audit/audit-logger.ts");
if (!auditLogger.includes("AUDIT_ACTION_TOUR_UPDATED")) {
  violations.push("audit-logger.ts: missing AUDIT_ACTION_TOUR_UPDATED");
}

const atomicPersist = read("src/canonical/atomic-canonical-tour-persist.ts");
if (!atomicPersist.includes("persistTourUpdateAtomically")) {
  violations.push("atomic-canonical-tour-persist.ts: missing persistTourUpdateAtomically");
}
if (!atomicPersist.includes("AUDIT_ACTION_TOUR_UPDATED")) {
  violations.push("atomic-canonical-tour-persist.ts: must use AUDIT_ACTION_TOUR_UPDATED");
}
if (!/appendAuditEvent\(tx,\s*\{[\s\S]*action:\s*AUDIT_ACTION_TOUR_UPDATED/.test(atomicPersist)) {
  violations.push("atomic-canonical-tour-persist.ts: appendAuditEvent must record TOUR_UPDATED");
}

const canonicalService = read("src/canonical/canonical-tour.service.ts");
if (!canonicalService.includes("persistTourUpdateAtomically")) {
  violations.push(
    "canonical-tour.service.ts: must route updates through persistTourUpdateAtomically"
  );
}

if (violations.length > 0) {
  console.error("guard-tour-update-audit: FAIL");
  for (const v of violations) {
    console.error(`  ${v}`);
  }
  process.exit(1);
}

console.log("guard-tour-update-audit: PASS");
