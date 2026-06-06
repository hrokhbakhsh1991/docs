#!/usr/bin/env node
/**
 * DEC-124 — CI/prod bootstrap uses migrate deploy only; infra/sql/001…004 reference-only.
 * @see docs/phase-5/appendices/migrate-deploy-only.md
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const API_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = path.resolve(API_ROOT, "../..");
const violations = [];

function read(rel) {
  return fs.readFileSync(path.join(REPO_ROOT, rel), "utf8");
}

function readApi(rel) {
  return fs.readFileSync(path.join(API_ROOT, rel), "utf8");
}

const workflowPaths = [".github/workflows/phase-4-gate.yml", ".github/workflows/phase-5-gate.yml"];

for (const rel of workflowPaths) {
  if (!fs.existsSync(path.join(REPO_ROOT, rel))) {
    violations.push(`${rel} must exist`);
    continue;
  }
  const content = read(rel);
  if (content.includes("infra/sql/001")) {
    violations.push(`${rel} must not apply infra/sql/001 (DEC-124)`);
  }
  if (content.includes("migrate dev")) {
    violations.push(`${rel} must not run migrate dev (DEC-124)`);
  }
  if (content.includes("last_error JSONB")) {
    violations.push(`${rel} must not manually ALTER last_error (DEC-124)`);
  }
  if (!content.includes("migrate deploy") && !content.includes("db:migrate:deploy")) {
    violations.push(`${rel} must run migrate deploy`);
  }
}

const ciDoc = read("docs/phase-4/ci.md");
if (ciDoc.includes("migrate dev --name")) {
  violations.push("docs/phase-4/ci.md gate bootstrap must not use migrate dev");
}
if (ciDoc.includes("infra/sql/001_tenant_rls.sql") && ciDoc.includes("pnpm run phase-4:gate")) {
  const gateBlock = ciDoc.slice(
    ciDoc.indexOf("pnpm run phase-4:gate") - 500,
    ciDoc.indexOf("pnpm run phase-4:gate") + 50
  );
  if (gateBlock.includes("001_tenant_rls")) {
    violations.push("docs/phase-4/ci.md gate path must not apply infra/sql/001");
  }
}

const postgresGates = read("docs/phase-5/appendices/postgres-required-gates.md");
if (postgresGates.includes("infra/sql/001")) {
  violations.push("postgres-required-gates.md must not bootstrap with infra/sql/001");
}
if (postgresGates.includes("last_error JSONB")) {
  violations.push("postgres-required-gates.md must not manual ALTER last_error");
}

const apiPkg = readApi("package.json");
if (!apiPkg.includes("db:migrate:deploy")) {
  violations.push("apps/api package.json must define db:migrate:deploy");
}
if (!apiPkg.includes("db-migrate-deploy.mjs")) {
  violations.push("db:migrate:deploy must route through db-migrate-deploy.mjs (owner URL)");
}

for (const rel of ["docs/phase-5/appendices/migrate-deploy-only.md", "infra/sql/README.md"]) {
  if (!fs.existsSync(path.join(REPO_ROOT, rel))) {
    violations.push(`${rel} must exist`);
  }
}

if (violations.length > 0) {
  console.error("guard-migrate-deploy-only: FAIL");
  for (const v of violations) {
    console.error(`  ${v}`);
  }
  process.exit(1);
}

console.log("guard-migrate-deploy-only: PASS");
