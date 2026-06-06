#!/usr/bin/env node
/**
 * AUDIT-GAP-03 / DEC-127 — tenant provision must append TENANT_PROVISIONED audit row.
 * @see docs/phase-4/subphases/4.3-provisioning.md
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
if (!auditLogger.includes("AUDIT_ACTION_TENANT_PROVISIONED")) {
  violations.push("audit-logger.ts: missing AUDIT_ACTION_TENANT_PROVISIONED");
}

const provisioning = read("src/internal/provisioning.service.ts");
if (!provisioning.includes("AUDIT_ACTION_TENANT_PROVISIONED")) {
  violations.push("provisioning.service.ts: must import AUDIT_ACTION_TENANT_PROVISIONED");
}
if (
  !/appendAuditEvent\(tx,\s*\{[\s\S]*action:\s*AUDIT_ACTION_TENANT_PROVISIONED/.test(provisioning)
) {
  violations.push("provisioning.service.ts: createTenantRow must append TENANT_PROVISIONED audit");
}
if (!provisioning.includes("runWithTenantContext")) {
  violations.push(
    "provisioning.service.ts: provision audit must bind tenant ALS via runWithTenantContext"
  );
}

if (violations.length > 0) {
  console.error("guard-tenant-provision-audit: FAIL");
  for (const v of violations) {
    console.error(`  ${v}`);
  }
  process.exit(1);
}

console.log("guard-tenant-provision-audit: PASS");
