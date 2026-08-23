/**
 * Assert MAIN_BRANCH_REQUIRED_CHECKS job names match workflow YAML `jobs.*.name`.
 * No GitHub API — catches rename drift before branch protection goes stale.
 *
 * Usage: node scripts/ops/verify-required-check-names.mjs
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  BOOKING_POSTGRES_REQUIRED_CHECKS,
  MAIN_BRANCH_REQUIRED_CHECKS,
} from "./main-branch-required-checks.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

/** Workflow files whose job `name:` values must appear in branch protection. */
const WORKFLOW_EXPECTATIONS = [
  {
    file: ".github/workflows/phase-0-gate.yml",
    requiredNames: ["Phase 0 foundation gate", "Phase 0 integration gate"],
  },
  {
    file: ".github/workflows/phase-1-gate.yml",
    requiredNames: ["Phase 1 platform-core gate"],
  },
  {
    file: ".github/workflows/booking-postgres-gate.yml",
    requiredNames: [...BOOKING_POSTGRES_REQUIRED_CHECKS],
  },
  {
    file: ".github/workflows/prod-3-release-gate.yml",
    requiredNames: ["Production readiness L3 release gate"],
  },
];

/**
 * Extract top-level job `name:` values (not step names).
 * Jobs are under `jobs:` with 2-space indent; job name keys are 4-space; `name:` is 4-space under job.
 */
function extractJobDisplayNames(yamlText) {
  const lines = yamlText.split("\n");
  const names = [];
  let inJobs = false;
  let currentJobIndent = null;

  for (const line of lines) {
    if (/^jobs:\s*$/.test(line)) {
      inJobs = true;
      currentJobIndent = null;
      continue;
    }
    if (!inJobs) continue;
    if (/^[a-zA-Z]/.test(line) && !line.startsWith(" ")) {
      break;
    }
    const jobKey = line.match(/^ {2}([A-Za-z0-9_-]+):\s*$/);
    if (jobKey) {
      currentJobIndent = 2;
      continue;
    }
    if (currentJobIndent === 2) {
      const nameMatch = line.match(/^ {4}name:\s*(.+)\s*$/);
      if (nameMatch) {
        names.push(nameMatch[1].replace(/^["']|["']$/g, "").trim());
      }
    }
  }
  return names;
}

let failed = false;

for (const { file, requiredNames } of WORKFLOW_EXPECTATIONS) {
  const abs = join(root, file);
  const yaml = readFileSync(abs, "utf8");
  const found = extractJobDisplayNames(yaml);
  for (const required of requiredNames) {
    if (!found.includes(required)) {
      console.error(`FAIL: ${file} missing job name "${required}" (found: ${found.join(", ") || "(none)"})`);
      failed = true;
    } else {
      console.log(`OK: ${file} → "${required}"`);
    }
    if (!MAIN_BRANCH_REQUIRED_CHECKS.includes(required)) {
      console.error(`FAIL: configure-main-branch-protection.mjs missing required check "${required}"`);
      failed = true;
    } else {
      console.log(`OK: MAIN_BRANCH_REQUIRED_CHECKS includes "${required}"`);
    }
  }
}

for (const check of MAIN_BRANCH_REQUIRED_CHECKS) {
  const covered = WORKFLOW_EXPECTATIONS.some((w) => w.requiredNames.includes(check));
  if (!covered) {
    console.error(`FAIL: MAIN_BRANCH_REQUIRED_CHECKS has orphan "${check}" with no workflow expectation`);
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}
console.log("OK: required check names match workflows + protection script.");
