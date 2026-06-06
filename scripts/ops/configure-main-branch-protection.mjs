#!/usr/bin/env node
/**
 * Configure required status checks on `main` (Phase 0 foundation + integration + Phase 1).
 * Preserves any existing required contexts. Requires: gh auth login + repo admin.
 *
 * @see reports/GITHUB_BRANCH_PROTECTION.md
 */
import { execFileSync } from "node:child_process";

const BRANCH = "main";

/** Exact GitHub Actions job `name:` values from workflow YAML. */
export const MAIN_BRANCH_REQUIRED_CHECKS = [
  "Phase 0 foundation gate",
  "Phase 0 integration gate",
  "Phase 1 platform-core gate",
];

function ghJson(args) {
  const out = execFileSync("gh", ["api", ...args], { encoding: "utf8" });
  return JSON.parse(out);
}

function ghPut(path, body) {
  execFileSync("gh", ["api", path, "-X", "PUT", "--input", "-"], {
    input: JSON.stringify(body),
    stdio: ["pipe", "inherit", "inherit"],
  });
}

try {
  execFileSync("gh", ["auth", "status"], { stdio: "pipe" });
} catch {
  console.error("ERROR: gh not authenticated. Run: gh auth login");
  process.exit(1);
}

const { nameWithOwner } = JSON.parse(
  execFileSync("gh", ["repo", "view", "--json", "nameWithOwner"], { encoding: "utf8" })
);
const [owner, repo] = nameWithOwner.split("/");

let existing = [];
try {
  const protection = ghJson([`repos/${owner}/${repo}/branches/${BRANCH}/protection`]);
  existing = protection.required_status_checks?.contexts ?? [];
} catch (err) {
  const msg = String(err.stderr ?? err.message ?? err);
  if (!msg.includes("404")) {
    console.error("Failed to read branch protection:", msg);
    process.exit(1);
  }
  console.log(`No existing protection on ${BRANCH}; creating rule.`);
}

const contexts = [...new Set([...existing, ...MAIN_BRANCH_REQUIRED_CHECKS])].sort();

const body = {
  required_status_checks: {
    strict: true,
    contexts,
  },
  enforce_admins: false,
  required_pull_request_reviews: null,
  restrictions: null,
  required_linear_history: false,
  allow_force_pushes: false,
  allow_deletions: false,
  block_creations: false,
  required_conversation_resolution: false,
  lock_branch: false,
  allow_fork_syncing: false,
};

console.log(`Updating ${nameWithOwner} branch ${BRANCH} required checks:`);
for (const c of contexts) {
  const tag = MAIN_BRANCH_REQUIRED_CHECKS.includes(c) ? " (phase gate)" : "";
  console.log(`  - ${c}${tag}`);
}

ghPut(`repos/${owner}/${repo}/branches/${BRANCH}/protection`, body);
console.log("OK: branch protection updated.");
