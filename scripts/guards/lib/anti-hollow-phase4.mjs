#!/usr/bin/env node
/**
 * Phase 4 — detect hollow tests bound to P4-E-* in verification matrix.
 * FAIL if mechanism file has no assert.* and matches known placeholder patterns.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");

/** @type {{ id: string, enforcementId?: string, paths: string[] }[]} */
const MECHANISM_FILES = [
  {
    id: "P4-E-RLS-01",
    enforcementId: "P4-E-RLS-01",
    paths: ["apps/api/test/rls-isolation.integration.spec.ts"],
  },
];

const PLACEHOLDER_MARKERS = [
  /ships when/i,
  /Full Testcontainers proof/i,
  /TODO closure/i,
];

/**
 * @param {string} content
 */
function hasAssertions(content) {
  return /\bassert\s*\./.test(content) || /\bassertion\s*\./.test(content);
}

/**
 * @param {string} content
 */
function hasEmptySkippedIt(content) {
  return (
    /it\s*\([^)]*skip:\s*!process\.env\.DATABASE_URL[^)]*\)\s*,\s*async\s*\(\)\s*=>\s*\{\s*(?:\/\/[^\n]*\n\s*)*\}/s.test(
      content,
    ) && !hasAssertions(content)
  );
}

/**
 * @returns {{ ok: boolean, detail: string | null }}
 */
export function evaluateAntiHollowPhase4() {
  const failures = [];

  for (const entry of MECHANISM_FILES) {
    for (const rel of entry.paths) {
      const abs = path.join(REPO_ROOT, rel);
      if (!fs.existsSync(abs)) {
        failures.push(`${rel} missing (bound to ${entry.id})`);
        continue;
      }
      const content = fs.readFileSync(abs, "utf8");
      if (!hasAssertions(content)) {
        failures.push(`${rel}: no assertions (hollow — ${entry.id})`);
      }
      if (PLACEHOLDER_MARKERS.some((re) => re.test(content)) && !hasAssertions(content)) {
        failures.push(`${rel}: placeholder comment without asserts (${entry.id})`);
      }
      if (hasEmptySkippedIt(content)) {
        failures.push(`${rel}: empty skipped it() body (${entry.id})`);
      }
    }
  }

  return {
    ok: failures.length === 0,
    detail: failures.length ? failures.join("; ") : null,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = evaluateAntiHollowPhase4();
  if (!r.ok) {
    console.error(`anti-hollow-phase4: FAIL — ${r.detail}`);
    process.exit(1);
  }
  console.log("anti-hollow-phase4: PASS");
}
