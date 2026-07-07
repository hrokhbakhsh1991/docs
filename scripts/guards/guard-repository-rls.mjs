#!/usr/bin/env node
/**
 * Phase 5 — repository tenant-scope guard.
 * @see docs/dev/ci-defensive-guards.mdoc
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const API_SRC = path.join(REPO_ROOT, "apps/api/src");

/** Prisma delegate names that require withTenantRls when accessed via app pool. */
const TENANT_DELEGATES = [
  "operatorPendingInvite",
  "operatorRegistration",
  "tour",
  "userTenant",
  "outboxEvent",
  "payment",
  "paymentReceipt",
  "exposureProfile",
  "exposureIntent",
  "integrationConnection",
  "integrationDeliveryJob",
];

const TENANT_DELEGATE_RE = new RegExp(
  `\\.(${TENANT_DELEGATES.join("|")})\\b`
);

/**
 * Methods intentionally using app-pool cross-tenant or legacy patterns until follow-up.
 * Format: repo-relative path from apps/api/src without leading src/
 */
const LEGACY_ALLOWLIST = new Set([
]);

function walkRepositoryFiles(dir, out = []) {
  if (!fs.existsSync(dir)) {
    return out;
  }
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "node_modules" || ent.name === "dist") {
        continue;
      }
      walkRepositoryFiles(full, out);
    } else if (
      ent.name.endsWith(".repository.ts") &&
      !ent.name.startsWith("in-memory-")
    ) {
      out.push(full);
    }
  }
  return out;
}

/**
 * @param {string} source
 * @returns {Array<{ name: string; body: string }>}
 */
function extractAsyncMethods(source) {
  /** @type {Array<{ name: string; body: string }>} */
  const methods = [];
  const re = /async\s+([A-Za-z0-9_]+)\s*\([^)]*\)\s*(?::\s*[^{]+)?\{/g;
  let match = re.exec(source);
  while (match !== null) {
    const name = match[1];
    const start = match.index + match[0].length;
    let depth = 1;
    let i = start;
    while (i < source.length && depth > 0) {
      const ch = source[i];
      if (ch === "{") {
        depth += 1;
      } else if (ch === "}") {
        depth -= 1;
      }
      i += 1;
    }
    methods.push({ name, body: source.slice(start, i - 1) });
    match = re.exec(source);
  }
  return methods;
}

/** @type {string[]} */
const violations = [];

for (const file of walkRepositoryFiles(API_SRC)) {
  const relFromSrc = path.relative(API_SRC, file).replaceAll("\\", "/");
  const source = fs.readFileSync(file, "utf8");

  for (const { name, body } of extractAsyncMethods(source)) {
    const allowKey = `${relFromSrc}:${name}`;
    if (LEGACY_ALLOWLIST.has(allowKey)) {
      continue;
    }
    if (!TENANT_DELEGATE_RE.test(body)) {
      continue;
    }
    if (!body.includes("getPrisma()")) {
      continue;
    }
    if (body.includes("getPrismaAdmin()")) {
      continue;
    }
    if (body.includes("withTenantRls(")) {
      continue;
    }
    violations.push(
      `${relFromSrc}:${name} — getPrisma() accesses tenant model without withTenantRls`
    );
  }
}

if (violations.length > 0) {
  console.error("guard-repository-rls: FAIL");
  for (const violation of violations) {
    console.error(`  ${violation}`);
  }
  process.exit(1);
}

console.log(
  "guard-repository-rls: PASS (repository methods use withTenantRls or allowlist for tenant models)"
);
