#!/usr/bin/env node
/**
 * AP5 / P0 — Bookings getById must be tenant-scoped (no admin full-row probe).
 * @see docs/dev/ci-defensive-guards.mdoc
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const BOOKINGS_REPO = path.join(
  REPO_ROOT,
  "apps/api/src/bookings/prisma-bookings.repository.ts"
);

/** @type {string[]} */
const violations = [];

if (!fs.existsSync(BOOKINGS_REPO)) {
  console.error("guard-bookings-getbyid-tenant-scope: FAIL — prisma-bookings.repository.ts missing");
  process.exit(1);
}

const source = fs.readFileSync(BOOKINGS_REPO, "utf8");
const getByIdBody = source.match(/async getById\([\s\S]*?\n  \}/)?.[0];

if (getByIdBody === undefined) {
  violations.push("getById method not found");
} else {
  if (!/getById\(id: string, tenantId: string\)/.test(getByIdBody)) {
    violations.push("getById must accept (id: string, tenantId: string)");
  }
  if (/getPrismaAdmin\s*\(/.test(getByIdBody)) {
    violations.push("getById must not use getPrismaAdmin() — pass tenantId from caller");
  }
  if (!/withTenantRls\s*\(/.test(getByIdBody)) {
    violations.push("getById must run inside withTenantRls");
  }
  if (!/findFirst/.test(getByIdBody)) {
    violations.push("getById must use findFirst({ where: { id, tenantId } })");
  }
}

const adminRegistrationBlocks = [
  ...source.matchAll(
    /getPrismaAdmin\(\)\.operatorRegistration\.find(?:Unique|First)\([\s\S]*?\)/g
  ),
];
for (const match of adminRegistrationBlocks) {
  const block = match[0];
  if (!/select:\s*\{\s*tenantId:\s*true\s*\}/.test(block)) {
    violations.push(
      "getPrismaAdmin().operatorRegistration probe must select { tenantId: true } only"
    );
    break;
  }
}

if (violations.length > 0) {
  console.error("guard-bookings-getbyid-tenant-scope: FAIL");
  for (const violation of violations) {
    console.error(`  ${violation}`);
  }
  process.exit(1);
}

console.log(
  "guard-bookings-getbyid-tenant-scope: PASS (tenant-scoped getById; admin probes minimal)"
);
