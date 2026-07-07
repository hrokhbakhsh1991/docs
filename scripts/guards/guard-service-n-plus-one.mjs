#!/usr/bin/env node
/**
 * Phase 5b — service-layer N+1 loop guard.
 * @see docs/dev/ci-defensive-guards.mdoc
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const API_SRC = path.join(REPO_ROOT, "apps/api/src");

/**
 * Known baseline violations — shrink as services batch queries.
 * Format: path/from/api/src/foo.service.ts:methodName
 */
const LEGACY_ALLOWLIST = new Set([]);

/** Rare admin/migration/dev paths — bounded iteration, not hot-path regressions. */
const ADMIN_ALLOWLIST = new Set([
  "canonical/migrate-canonical-workspace.service.ts:migrateWorkspaceCanonicalForTenant",
  "internal/provisioning.service.ts:seedDevTenants",
]);

const LOOP_START_RE = /\b(for\s*(?:await\s*)?\(|while\s*\(|\.map\s*\(\s*async)/g;

const QUERY_IN_LOOP_RE =
  /await[\s\S]{0,400}(?:\.(?:find(?:Unique|First|Many)?|list[A-Z]\w*|get[A-Z]\w*|create|update|upsert|delete|count)\s*\(|getPrisma\s*\(|withTenantRls\s*\(|(?:repo|repository|Repo)\.\w+\()/;

function walkServiceFiles(dir, out = []) {
  if (!fs.existsSync(dir)) {
    return out;
  }
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "node_modules" || ent.name === "dist") {
        continue;
      }
      walkServiceFiles(full, out);
    } else if (ent.name.endsWith(".service.ts")) {
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

/**
 * @param {string} fragment
 * @param {number} braceIndex
 */
function blockFromBrace(fragment, braceIndex) {
  let depth = 0;
  for (let i = braceIndex; i < fragment.length; i += 1) {
    const ch = fragment[i];
    if (ch === "{") {
      depth += 1;
    } else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        return fragment.slice(braceIndex + 1, i);
      }
    }
  }
  return null;
}

/**
 * @param {string} methodBody
 * @returns {string[]}
 */
function extractLoopBodies(methodBody) {
  /** @type {string[]} */
  const bodies = [];
  LOOP_START_RE.lastIndex = 0;
  let match = LOOP_START_RE.exec(methodBody);
  while (match !== null) {
    const fragment = methodBody.slice(match.index);
    const braceIdx = fragment.indexOf("{");
    if (braceIdx >= 0 && braceIdx < 240) {
      const block = blockFromBrace(fragment, braceIdx);
      if (block !== null) {
        bodies.push(block);
      }
    } else {
      const headMatch = fragment.match(
        /^(?:for\s*(?:await\s*)?\([^)]*\)|while\s*\([^)]*\))\s*([\s\S]{0,300}?)(?=\n\s*(?:for|while|if|return|const|let|var|await|\})|$)/
      );
      if (headMatch?.[1]?.includes("await")) {
        bodies.push(headMatch[1]);
      }
    }
    match = LOOP_START_RE.exec(methodBody);
  }
  return bodies;
}

/**
 * @param {string} loopBody
 */
function loopHasAwaitedQuery(loopBody) {
  return loopBody.includes("await") && QUERY_IN_LOOP_RE.test(loopBody);
}

/** @type {string[]} */
const violations = [];

for (const file of walkServiceFiles(API_SRC)) {
  const relFromSrc = path.relative(API_SRC, file).replaceAll("\\", "/");
  const source = fs.readFileSync(file, "utf8");

  for (const { name, body } of extractAsyncMethods(source)) {
    const allowKey = `${relFromSrc}:${name}`;
    if (LEGACY_ALLOWLIST.has(allowKey) || ADMIN_ALLOWLIST.has(allowKey)) {
      continue;
    }

    for (const loopBody of extractLoopBodies(body)) {
      if (loopHasAwaitedQuery(loopBody)) {
        violations.push(
          `${allowKey} — await + repository/Prisma query inside loop (N+1 risk)`
        );
        break;
      }
    }
  }
}

if (violations.length > 0) {
  console.error("guard-service-n-plus-one: FAIL");
  for (const violation of violations) {
    console.error(`  ${violation}`);
  }
  process.exit(1);
}

console.log(
  "guard-service-n-plus-one: PASS (no unallowlisted await-in-loop DB access in services)"
);
