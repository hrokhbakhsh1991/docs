#!/usr/bin/env node
/**
 * DEC-097 — migration head constant must match latest Prisma migration folder.
 * @see docs/phase-5/appendices/migration-head-preflight.md
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const violations = [];

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

const migrationsDir = path.join(ROOT, "prisma/migrations");
const folders = fs
  .readdirSync(migrationsDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();
const latest = folders.at(-1);

const preflight = read("src/db/migration-head-preflight.ts");
const match = preflight.match(/EXPECTED_PRISMA_MIGRATION_HEAD\s*=\s*"([^"]+)"/);
const embedded = match?.[1];

if (!embedded) {
  violations.push("migration-head-preflight.ts must define EXPECTED_PRISMA_MIGRATION_HEAD");
} else if (embedded !== latest) {
  violations.push(
    `EXPECTED_PRISMA_MIGRATION_HEAD (${embedded}) must match latest migration (${latest})`
  );
}

const integrity = read("src/db/assert-production-database-integrity.ts");
if (!integrity.includes("assertProductionMigrationHead")) {
  violations.push(
    "assert-production-database-integrity.ts must call assertProductionMigrationHead"
  );
}

if (violations.length > 0) {
  console.error("guard-migration-head-preflight: FAIL");
  for (const v of violations) {
    console.error(`  ${v}`);
  }
  process.exit(1);
}

console.log("guard-migration-head-preflight: PASS");
