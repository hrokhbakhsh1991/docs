#!/usr/bin/env node
/**
 * Phase 1 step 9 — CI meta-guard: unscoped queries, session-local RLS GUC, id-only tour reads.
 * @see docs/phase-5/appendices/IMPLEMENTATION-DECISIONS.md DEC-036
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const GUARDS = [
  { script: "guard-no-raw-queries.mjs", label: "guard:api-queries" },
  { script: "guard-rls-session-local.mjs", label: "guard:rls-session-local" },
  { script: "guard-no-id-only-tour-read.mjs", label: "guard:id-only-tour-read" },
];

let failed = false;

for (const { script, label } of GUARDS) {
  const result = spawnSync(process.execPath, [path.join(ROOT, "scripts", script)], {
    cwd: ROOT,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    console.error(`guard-tenant-isolation: FAIL at ${label}`);
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}

console.log("guard-tenant-isolation: PASS (api-queries + rls-session-local + id-only-tour-read)");
