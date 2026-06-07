#!/usr/bin/env node
/**
 * Fail fast before pnpm test when an old urban genericity proof is checked out.
 * Skips when @app-tour/workspace-urban is absent (e.g. main before Phase 7 merge).
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function resolveRepoRoot() {
  try {
    return execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
  } catch {
    return join(dirname(fileURLToPath(import.meta.url)), "..");
  }
}

const REPO_ROOT = resolveRepoRoot();
const SPEC = join(REPO_ROOT, "packages/workspaces/urban/test/phase-7.contract.spec.ts");
const BASELINE = join(REPO_ROOT, "reports/phase-7-genericity-baseline.yaml");
const REQUIRED_REV = "PHASE_7_GENERICITY_PROOF_REV = 4";

if (!existsSync(SPEC)) {
  console.log("verify-phase-7-genericity-proof-rev: SKIP (urban package absent)");
  process.exit(0);
}

let head = "unknown";
try {
  head = execSync("git rev-parse HEAD", { cwd: REPO_ROOT, encoding: "utf8" }).trim();
} catch {
  // non-git environment — still validate file contents
}

const specSrc = readFileSync(SPEC, "utf8");
console.log(`::notice title=Phase 7 genericity proof::HEAD ${head} rev=4`);
console.log(`verify-phase-7-genericity-proof-rev: HEAD ${head}`);

if (specSrc.includes("assertPlatformCoreMatchesFingerprint")) {
  console.error(
    "verify-phase-7-genericity-proof-rev: FAIL — stale proof (fingerprint JSON era).",
  );
  console.error(
    "Checkout latest phase-7/entry-gate (ab94c78+). Do not use Re-run failed jobs on an old workflow run.",
  );
  process.exit(1);
}

for (const needle of [
  REQUIRED_REV,
  "assertPlatformCoreMatchesTreeDigest",
  "platform_core_tree_digest",
]) {
  const haystack =
    needle === "platform_core_tree_digest" ? readFileSync(BASELINE, "utf8") : specSrc;
  if (!haystack.includes(needle)) {
    console.error(`verify-phase-7-genericity-proof-rev: FAIL — missing ${needle}`);
    process.exit(1);
  }
}

console.log("verify-phase-7-genericity-proof-rev: PASS");
