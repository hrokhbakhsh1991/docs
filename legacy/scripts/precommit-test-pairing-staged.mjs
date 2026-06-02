#!/usr/bin/env node
/**
 * Pre-commit Test-Pairing gate for staged source files.
 * Invoked by lint-staged with staged paths as argv.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  formatTestPairMessage,
  hasTestPair,
  isSubjectFile,
} from "./test-pairing-core.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

const STAGED = process.argv
  .slice(2)
  .filter((f) => /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(f));

if (STAGED.length === 0) {
  process.exit(0);
}

const added = spawnSync("git", ["diff", "--cached", "--name-only", "--diff-filter=A"], {
  cwd: REPO_ROOT,
  encoding: "utf8",
});
const addedRel = new Set(
  (added.stdout ?? "")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((p) => p.replace(/\\/g, "/")),
);

const failures = [];

for (const file of STAGED) {
  const abs = path.isAbsolute(file) ? file : path.join(REPO_ROOT, file);
  const rel = path.relative(REPO_ROOT, abs).replace(/\\/g, "/");
  if (!addedRel.has(rel)) continue;
  if (!isSubjectFile(rel)) continue;
  if (hasTestPair(abs)) continue;
  failures.push(formatTestPairMessage(rel));
}

if (failures.length > 0) {
  console.error("Test-Pairing pre-commit gate failed:\n");
  for (const message of failures) {
    console.error(`  • ${message}`);
  }
  console.error(
    "\nEvery newly added file under features/ or services/ must have a co-located " +
      "`.spec.ts` / `.test.ts` (or under `__tests__/` in the same directory).",
  );
  process.exit(1);
}

process.exit(0);
