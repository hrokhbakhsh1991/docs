#!/usr/bin/env node
/**
 * Test-Pairing guardrail (same rules as ESLint `test-pairing/require-test-pair`).
 *
 *   node scripts/check-test-pairing.mjs
 *   node scripts/check-test-pairing.mjs --json
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { findMissingTestPairs } from "./test-pairing-core.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const asJson = process.argv.includes("--json");

const missing = findMissingTestPairs(REPO_ROOT);

if (asJson) {
  console.log(JSON.stringify({ ok: missing.length === 0, count: missing.length, missing }, null, 2));
} else if (missing.length === 0) {
  console.log("Test-Pairing: all subject files have co-located tests.");
} else {
  console.error(`Test-Pairing: ${missing.length} subject file(s) missing co-located tests:\n`);
  for (const { rel, expected } of missing) {
    console.error(`  ${rel}  (expected e.g. ${expected})`);
  }
}

process.exit(missing.length === 0 ? 0 : 1);
