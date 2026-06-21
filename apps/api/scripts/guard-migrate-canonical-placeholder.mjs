#!/usr/bin/env node
/**
 * DEC-091 / Phase 6.8 — migrateCanonical must not wire on POST/PATCH write paths.
 * Denali ACL execution is allowed via migrate-canonical-workspace.service.ts only.
 * @see docs/phase-5/appendices/migrate-canonical-phase6-placeholder.md
 * @see docs/phase-6/subphases/6.8-migrate-canonical.md
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const violations = [];

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

const hook = read("src/canonical/migrate-canonical-hook.ts");
if (!hook.includes("resolveMigrateCanonicalHook")) {
  violations.push("migrate-canonical-hook.ts must export resolveMigrateCanonicalHook");
}
const migrateService = read("src/canonical/migrate-canonical-workspace.service.ts");
if (!migrateService.includes("MIGRATE_CANONICAL_TENANT_IDS")) {
  violations.push("migrate-canonical-workspace.service.ts must gate on MIGRATE_CANONICAL_TENANT_IDS");
}

const writePathGlobs = [
  "src/tours/tours.service.ts",
  "src/tours/tours.routes.ts",
  "src/canonical/canonical-tour.service.ts",
  "src/storage/prisma-tour.repository.ts",
  "src/db/with-canonical-transaction.ts",
];

for (const rel of writePathGlobs) {
  const content = read(rel);
  if (
    content.includes("migrate-canonical-hook") ||
    content.includes("migrateCanonicalNotImplemented")
  ) {
    violations.push(`${rel} must not import migrate-canonical-hook in Phase 5`);
  }
}

if (violations.length > 0) {
  console.error("guard-migrate-canonical-placeholder: FAIL");
  for (const v of violations) {
    console.error(`  ${v}`);
  }
  process.exit(1);
}

console.log("guard-migrate-canonical-placeholder: PASS");
