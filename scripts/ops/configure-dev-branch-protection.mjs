#!/usr/bin/env node
/**
 * Configure required status checks + PR-only merges on `dev` (staging trunk).
 * Preserves any existing required contexts. Requires: gh auth login + repo admin.
 *
 * Modes:
 *   (default)     apply protection via GitHub API
 *   --dry-run     print planned contexts; no API write (still needs gh for current state)
 *   --verify      fail if dev gates missing from current protection
 *   --print-only  print DEV_BRANCH_REQUIRED_CHECKS; no network
 *
 * @see docs/dev/deployment-branch-model.md
 * @see reports/GITHUB_BRANCH_PROTECTION.md
 */
import { execFileSync, spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  BOOKING_POSTGRES_REQUIRED_CHECKS,
  DEV_BRANCH_REQUIRED_CHECKS,
} from "./dev-branch-required-checks.mjs";

export { BOOKING_POSTGRES_REQUIRED_CHECKS, DEV_BRANCH_REQUIRED_CHECKS };

const BRANCH = "dev";
const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const verifyOnly = args.has("--verify");
const printOnly = args.has("--print-only");

const here = dirname(fileURLToPath(import.meta.url));

function assertLocalNameDrift() {
  const probe = spawnSync(process.execPath, [join(here, "verify-dev-required-check-names.mjs")], {
    encoding: "utf8",
  });
  if (probe.status !== 0) {
    console.error(probe.stdout || "");
    console.error(probe.stderr || "");
    console.error("ERROR: local dev required-check name drift (workflow vs script).");
    process.exit(1);
  }
}

function ghJson(apiArgs) {
  const out = execFileSync("gh", ["api", ...apiArgs], { encoding: "utf8" });
  return JSON.parse(out);
}

function ghPut(path, body) {
  const result = spawnSync("gh", ["api", path, "-X", "PUT", "--input", "-"], {
    input: JSON.stringify(body),
    encoding: "utf8",
  });
  if (result.status !== 0) {
    const msg = `${result.stderr || ""}${result.stdout || ""}`.trim();
    const err = new Error(msg || `gh api PUT ${path} failed`);
    err.status = result.status;
    throw err;
  }
}

function requireGhAuth() {
  try {
    execFileSync("gh", ["auth", "status"], { stdio: "pipe" });
  } catch {
    console.error("ERROR: gh not authenticated. Run: gh auth login");
    console.error("Then: pnpm run ops:branch-protection:dev");
    process.exit(1);
  }
}

assertLocalNameDrift();

if (printOnly) {
  console.log("DEV_BRANCH_REQUIRED_CHECKS:");
  for (const c of DEV_BRANCH_REQUIRED_CHECKS) {
    const booking = BOOKING_POSTGRES_REQUIRED_CHECKS.includes(c) ? " [booking-pg]" : "";
    console.log(`  - ${c}${booking}`);
  }
  process.exit(0);
}

requireGhAuth();

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
  const soft403 =
    process.env.BRANCH_PROTECTION_VERIFY_SOFT_403 === "1" ||
    process.env.BRANCH_PROTECTION_VERIFY_SOFT_403 === "true";
  const is403 = /403|Resource not accessible by integration/i.test(msg);
  if (verifyOnly && soft403 && is403) {
    console.warn(
      "WARN: cannot read branch protection (HTTP 403) — Actions token lacks administration:read."
    );
    console.warn("WARN: soft-skipping live verify.");
    process.exit(0);
  }
  if (is403 && !verifyOnly) {
    console.warn(
      "WARN: cannot read existing branch protection (HTTP 403) — continuing with planned contexts only."
    );
    console.warn("WARN: repo admin PAT required to apply; run locally: pnpm run ops:branch-protection:dev");
  } else if (!msg.includes("404")) {
    console.error("Failed to read branch protection:", msg);
    process.exit(1);
  } else {
    console.log(`No existing protection on ${BRANCH}; creating rule.`);
  }
}

if (verifyOnly) {
  const missing = DEV_BRANCH_REQUIRED_CHECKS.filter((c) => !existing.includes(c));
  console.log(`Current required contexts on ${nameWithOwner}@${BRANCH} (${existing.length}):`);
  for (const c of existing.sort()) {
    const mark = DEV_BRANCH_REQUIRED_CHECKS.includes(c) ? "✓" : "·";
    console.log(`  ${mark} ${c}`);
  }
  if (missing.length > 0) {
    console.error("FAIL: missing required checks:");
    for (const c of missing) {
      console.error(`  - ${c}`);
    }
    console.error("Run: pnpm run ops:branch-protection:dev");
    process.exit(1);
  }
  console.log("OK: all dev staging gates are required.");
  process.exit(0);
}

const contexts = [...new Set([...existing, ...DEV_BRANCH_REQUIRED_CHECKS])].sort();

const body = {
  required_status_checks: {
    strict: true,
    contexts,
  },
  enforce_admins: false,
  required_pull_request_reviews: {
    dismiss_stale_reviews: false,
    require_code_owner_reviews: false,
    required_approving_review_count: 0,
  },
  restrictions: null,
  required_linear_history: false,
  allow_force_pushes: false,
  allow_deletions: false,
  block_creations: false,
  required_conversation_resolution: false,
  lock_branch: false,
  allow_fork_syncing: false,
};

console.log(
  `${dryRun ? "DRY-RUN" : "Updating"} ${nameWithOwner} branch ${BRANCH} required checks:`
);
for (const c of contexts) {
  const tags = [];
  if (BOOKING_POSTGRES_REQUIRED_CHECKS.includes(c)) tags.push("booking-pg");
  else if (DEV_BRANCH_REQUIRED_CHECKS.includes(c)) tags.push("dev-gate");
  const tag = tags.length ? ` (${tags.join(", ")})` : "";
  const added = !existing.includes(c) ? " [NEW]" : "";
  console.log(`  - ${c}${tag}${added}`);
}

const bookingPresent = BOOKING_POSTGRES_REQUIRED_CHECKS.every((c) => contexts.includes(c));
if (!bookingPresent) {
  console.error("ERROR: planned contexts missing Booking PostgreSQL checks — aborting.");
  process.exit(1);
}

if (dryRun) {
  console.log("DRY-RUN: no API write. Re-run without --dry-run to apply.");
  console.log("Also enables: require pull request before merging (0 approvals).");
  process.exit(0);
}

try {
  ghPut(`repos/${owner}/${repo}/branches/${BRANCH}/protection`, body);
} catch (err) {
  const msg = String(err.message ?? err);
  if (/403|Resource not accessible by integration/i.test(msg)) {
    console.error("ERROR: cannot update branch protection (HTTP 403).");
    console.error("Requires repo admin. On your machine:");
    console.error("  gh auth login");
    console.error("  pnpm run ops:branch-protection:dev");
    process.exit(1);
  }
  console.error("Failed to update branch protection:", msg);
  process.exit(1);
}
console.log("OK: dev branch protection updated.");
console.log("Verify: pnpm run ops:branch-protection:dev:verify");
