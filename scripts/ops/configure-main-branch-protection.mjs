#!/usr/bin/env node
/**
 * Configure required status checks on `main` (Phase 0 + Phase 1 + Booking PostgreSQL).
 * Preserves any existing required contexts. Requires: gh auth login + repo admin.
 *
 * Modes:
 *   (default)     apply protection via GitHub API
 *   --dry-run     print planned contexts; no API write (still needs gh for current state)
 *   --verify      fail if Booking / Phase gates missing from current protection
 *   --print-only  print MAIN_BRANCH_REQUIRED_CHECKS; no network
 *
 * @see reports/GITHUB_BRANCH_PROTECTION.md
 * @see docs/phase-20/p7/appendices/BOOKING_BRANCH_PROTECTION_GATE.md
 */
import { execFileSync, spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  BOOKING_POSTGRES_REQUIRED_CHECKS,
  MAIN_BRANCH_REQUIRED_CHECKS,
} from "./main-branch-required-checks.mjs";

export { BOOKING_POSTGRES_REQUIRED_CHECKS, MAIN_BRANCH_REQUIRED_CHECKS };

const BRANCH = "main";
const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const verifyOnly = args.has("--verify");
const printOnly = args.has("--print-only");

const here = dirname(fileURLToPath(import.meta.url));

function assertLocalNameDrift() {
  const probe = spawnSync(process.execPath, [join(here, "verify-required-check-names.mjs")], {
    encoding: "utf8",
  });
  if (probe.status !== 0) {
    console.error(probe.stdout || "");
    console.error(probe.stderr || "");
    console.error("ERROR: local required-check name drift (workflow vs script).");
    process.exit(1);
  }
}

function ghJson(apiArgs) {
  const out = execFileSync("gh", ["api", ...apiArgs], { encoding: "utf8" });
  return JSON.parse(out);
}

function ghPut(path, body) {
  execFileSync("gh", ["api", path, "-X", "PUT", "--input", "-"], {
    input: JSON.stringify(body),
    stdio: ["pipe", "inherit", "inherit"],
  });
}

function requireGhAuth() {
  try {
    execFileSync("gh", ["auth", "status"], { stdio: "pipe" });
  } catch {
    console.error("ERROR: gh not authenticated. Run: gh auth login");
    console.error("Then: pnpm run ops:branch-protection:main");
    process.exit(1);
  }
}

assertLocalNameDrift();

if (printOnly) {
  console.log("MAIN_BRANCH_REQUIRED_CHECKS:");
  for (const c of MAIN_BRANCH_REQUIRED_CHECKS) {
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
  if (!msg.includes("404")) {
    console.error("Failed to read branch protection:", msg);
    process.exit(1);
  }
  console.log(`No existing protection on ${BRANCH}; creating rule.`);
}

if (verifyOnly) {
  const missing = MAIN_BRANCH_REQUIRED_CHECKS.filter((c) => !existing.includes(c));
  console.log(`Current required contexts on ${nameWithOwner}@${BRANCH} (${existing.length}):`);
  for (const c of existing.sort()) {
    const mark = MAIN_BRANCH_REQUIRED_CHECKS.includes(c) ? "✓" : "·";
    console.log(`  ${mark} ${c}`);
  }
  if (missing.length > 0) {
    console.error("FAIL: missing required checks:");
    for (const c of missing) {
      console.error(`  - ${c}`);
    }
    console.error("Run: pnpm run ops:branch-protection:main");
    process.exit(1);
  }
  console.log("OK: all Phase 0/1 + Booking PostgreSQL checks are required.");
  process.exit(0);
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

console.log(
  `${dryRun ? "DRY-RUN" : "Updating"} ${nameWithOwner} branch ${BRANCH} required checks:`
);
for (const c of contexts) {
  const tags = [];
  if (BOOKING_POSTGRES_REQUIRED_CHECKS.includes(c)) tags.push("booking-pg");
  else if (MAIN_BRANCH_REQUIRED_CHECKS.includes(c)) tags.push("phase-gate");
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
  process.exit(0);
}

ghPut(`repos/${owner}/${repo}/branches/${BRANCH}/protection`, body);
console.log("OK: branch protection updated.");
console.log("Verify: pnpm run ops:branch-protection:verify");
