#!/usr/bin/env node
/**
 * CW8-07 — workspace policy modules must not call shared-stage APIs or import host apps.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

/** @param {string} dir */
function walkTsFiles(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walkTsFiles(full, out);
      continue;
    }
    if (entry.endsWith(".ts") && !entry.endsWith(".spec.ts") && full.includes("/policy/")) {
      out.push(full);
    }
  }
  return out;
}

const violations = [];

for (const file of walkTsFiles(join(REPO_ROOT, "packages/workspaces"))) {
  const rel = relative(REPO_ROOT, file);
  const source = readFileSync(file, "utf8");
  if (/\bvalidateCanonical\s*\(/.test(source)) {
    violations.push(`${rel}: policy module must not call validateCanonical (shared stage only)`);
  }
  if (/from\s+["']@apps\//.test(source) || /from\s+["'][^"']*apps\/api/.test(source)) {
    violations.push(`${rel}: policy module must not import apps/* host paths`);
  }
}

if (violations.length > 0) {
  console.error("guard-workspace-policy-no-core-branching: FAIL");
  for (const line of violations) {
    console.error(`  ${line}`);
  }
  process.exit(1);
}

console.log("guard-workspace-policy-no-core-branching: PASS");
