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
const RULE_CTX_SPEC = join(
  REPO_ROOT,
  "packages/platform-core/test/unit/utils/rule-context-tenant.spec.ts",
);
const REQUIRED_REV = "PHASE_7_GENERICITY_PROOF_REV = 4";
/** bf6c9f4 regression — breaks REQ-P7-007 vs baseline 64d9fea; fixed in b046bdb+. */
const BF6C9F4_REGRESSION = "Phase 6.6 registry smoke";
const BASELINE_TEST_TITLE = "Phase 6.6 denali smoke";

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

if (existsSync(RULE_CTX_SPEC)) {
  const ruleCtx = readFileSync(RULE_CTX_SPEC, "utf8");
  if (ruleCtx.includes(BF6C9F4_REGRESSION)) {
    console.error(
      "verify-phase-7-genericity-proof-rev: FAIL — bf6c9f4 platform-core regression (registry smoke title).",
    );
    console.error(
      `HEAD ${head} — checkout b046bdb+ or push latest phase-7/entry-gate; do not Re-run failed jobs on bf6c9f4.`,
    );
    process.exit(1);
  }
  if (!ruleCtx.includes(BASELINE_TEST_TITLE)) {
    console.error(
      "verify-phase-7-genericity-proof-rev: FAIL — platform-core test title drift vs 64d9fea baseline.",
    );
    console.error(`HEAD ${head} — expected "${BASELINE_TEST_TITLE}" in rule-context-tenant.spec.ts`);
    process.exit(1);
  }
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
