#!/usr/bin/env node
/**
 * AP15b — repository loops must not await prisma per iteration (N+1).
 *
 * @see docs/dev/ci-defensive-guards.mdoc
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const API_SRC = path.join(REPO_ROOT, "apps/api/src");

const SKIP_DIR_NAMES = new Set(["platform"]);

/** Repo-relative paths with documented batch exceptions. */
const FILE_ALLOWLIST = new Set([
  "bookings/prisma-bookings.repository.ts", // bulkApproveWithOutbox — single tx batch
]);

function walkRepositoryFiles(dir, out = []) {
  if (!fs.existsSync(dir)) {
    return out;
  }
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "node_modules" || ent.name === "dist" || SKIP_DIR_NAMES.has(ent.name)) {
        continue;
      }
      walkRepositoryFiles(full, out);
    } else if (ent.name.endsWith(".repository.ts") && !ent.name.startsWith("in-memory-")) {
      out.push(full);
    }
  }
  return out;
}

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

/** @type {string[]} */
const violations = [];

for (const file of walkRepositoryFiles(API_SRC)) {
  const relFromSrc = path.relative(API_SRC, file).replaceAll("\\", "/");
  if (FILE_ALLOWLIST.has(relFromSrc)) {
    continue;
  }

  const source = stripComments(fs.readFileSync(file, "utf8"));
  const relFromApi = path.relative(path.join(REPO_ROOT, "apps/api"), file);

  const forRegex = /\bfor\s*\([^)]*\)\s*\{/g;
  let forMatch = forRegex.exec(source);
  while (forMatch !== null) {
    const braceStart = forMatch.index + forMatch[0].length - 1;
    let depth = 0;
    let bodyEnd = braceStart;
    for (let i = braceStart; i < source.length; i += 1) {
      const ch = source[i];
      if (ch === "{") {
        depth += 1;
      } else if (ch === "}") {
        depth -= 1;
        if (depth === 0) {
          bodyEnd = i;
          break;
        }
      }
    }
    const body = source.slice(braceStart, bodyEnd + 1);
    const hasAwaitPrisma =
      /\bawait\b/.test(body) &&
      /\.(findMany|findFirst|findUnique|create|update|updateMany|createMany|delete|deleteMany|count|aggregate)\s*\(/.test(
        body
      );

    if (hasAwaitPrisma) {
      const line = source.slice(0, forMatch.index).split("\n").length;
      violations.push(`${relFromApi}:${line} for-loop with awaited prisma/repo call`);
    }
    forMatch = forRegex.exec(source);
  }
}

if (violations.length > 0) {
  console.error("guard-repository-n-plus-one: FAIL");
  for (const violation of violations) {
    console.error(`  ${violation}`);
  }
  process.exit(1);
}

console.log("guard-repository-n-plus-one: PASS (no awaited prisma in repository for-loops)");
