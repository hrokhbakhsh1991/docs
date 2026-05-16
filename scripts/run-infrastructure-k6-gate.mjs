#!/usr/bin/env node
/**
 * Optional local runner for Phase 5 k6 scripts (skips gracefully if k6 missing).
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

function hasK6() {
  const r = spawnSync("k6", ["version"], { encoding: "utf8" });
  return r.status === 0;
}

function runScript(rel) {
  const script = path.join(REPO_ROOT, rel);
  console.log(`\n[k6-gate] → ${rel}`);
  const r = spawnSync("k6", ["run", script], { stdio: "inherit", cwd: REPO_ROOT });
  if (r.status !== 0) {
    process.exit(r.status ?? 1);
  }
}

if (!hasK6()) {
  console.warn("[k6-gate] k6 not installed — running Node reality gate instead");
  const nodeGate = spawnSync(process.execPath, ["scripts/verify-infrastructure-reality-gate.mjs"], {
    stdio: "inherit",
    cwd: REPO_ROOT,
  });
  process.exit(nodeGate.status ?? 0);
}

runScript("scripts/k6/login-storm.js");
runScript("scripts/k6/concurrent-tenant-isolation.js");
console.log("\n[k6-gate] OK");
