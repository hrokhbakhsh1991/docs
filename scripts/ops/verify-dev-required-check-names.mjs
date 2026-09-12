/**
 * Assert DEV_BRANCH_REQUIRED_CHECKS job names match workflow YAML job contexts.
 * No GitHub API — catches rename drift before dev branch protection goes stale.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  BOOKING_POSTGRES_REQUIRED_CHECKS,
  DEV_BRANCH_REQUIRED_CHECKS,
} from "./dev-branch-required-checks.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

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
    file: ".github/workflows/phase-4-gate.yml",
    requiredNames: ["Phase 4 gate (Postgres required)"],
  },
  {
    file: ".github/workflows/phase-5-gate.yml",
    requiredNames: ["Phase 5 gate (Postgres required)"],
  },
  {
    file: ".github/workflows/booking-postgres-gate.yml",
    requiredNames: [...BOOKING_POSTGRES_REQUIRED_CHECKS],
  },
  {
    file: ".github/workflows/marketing-guard.yml",
    requiredNames: ["marketing-guard"],
  },
];

/** Job `name:` when set; otherwise the job key (GitHub status context). */
function extractJobContextNames(yamlText) {
  const lines = yamlText.split("\n");
  const names = [];
  let inJobs = false;
  let currentJobKey = null;

  for (const line of lines) {
    if (/^jobs:\s*$/.test(line)) {
      inJobs = true;
      currentJobKey = null;
      continue;
    }
    if (!inJobs) continue;
    if (/^[a-zA-Z]/.test(line) && !line.startsWith(" ")) {
      break;
    }
    const jobKey = line.match(/^ {2}([A-Za-z0-9_-]+):\s*$/);
    if (jobKey) {
      if (currentJobKey !== null) {
        names.push(currentJobKey);
      }
      currentJobKey = jobKey[1];
      continue;
    }
    if (currentJobKey !== null) {
      const nameMatch = line.match(/^ {4}name:\s*(.+)\s*$/);
      if (nameMatch) {
        names.push(nameMatch[1].replace(/^["']|["']$/g, "").trim());
        currentJobKey = null;
      }
    }
  }
  if (currentJobKey !== null) {
    names.push(currentJobKey);
  }
  return names;
}

let failed = false;

for (const { file, requiredNames } of WORKFLOW_EXPECTATIONS) {
  const abs = join(root, file);
  const yaml = readFileSync(abs, "utf8");
  const found = extractJobContextNames(yaml);
  for (const required of requiredNames) {
    if (!found.includes(required)) {
      console.error(
        `FAIL: ${file} missing job context "${required}" (found: ${found.join(", ") || "(none)"})`
      );
      failed = true;
    } else {
      console.log(`OK: ${file} → "${required}"`);
    }
    if (!DEV_BRANCH_REQUIRED_CHECKS.includes(required)) {
      console.error(`FAIL: dev-branch-required-checks.mjs missing required check "${required}"`);
      failed = true;
    } else {
      console.log(`OK: DEV_BRANCH_REQUIRED_CHECKS includes "${required}"`);
    }
  }
}

for (const check of DEV_BRANCH_REQUIRED_CHECKS) {
  const covered = WORKFLOW_EXPECTATIONS.some((w) => w.requiredNames.includes(check));
  if (!covered) {
    console.error(`FAIL: DEV_BRANCH_REQUIRED_CHECKS has orphan "${check}" with no workflow expectation`);
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}
console.log("OK: dev required check names match workflows + protection script.");
