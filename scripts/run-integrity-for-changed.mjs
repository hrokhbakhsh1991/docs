#!/usr/bin/env node
/**
 * Incremental integrity checks for changed source files (dev watcher + partial CI).
 * Mirrors ci-integrity-check.sh gates, scoped to the provided paths.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  formatTestPairMessage,
  hasTestPair,
  isSubjectFile,
} from "./test-pairing-core.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

const CODE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs)$/;

/** @param {string} relPosix */
function isWatchedSource(relPosix) {
  if (!CODE_EXT.test(relPosix)) return false;
  if (relPosix.includes("/node_modules/") || relPosix.includes("/dist/")) return false;
  return (
    /^apps\/[^/]+\/src\//.test(relPosix) ||
    /^packages\/[^/]+\/src\//.test(relPosix) ||
    /^apps\/web\/lib\//.test(relPosix)
  );
}

/** @param {string} file */
function toRepoRelative(file) {
  const abs = path.isAbsolute(file) ? file : path.join(REPO_ROOT, file);
  return path.relative(REPO_ROOT, abs).replace(/\\/g, "/");
}

const rawFiles = process.argv.slice(2).map(toRepoRelative).filter(isWatchedSource);
const files = [...new Set(rawFiles)];

if (files.length === 0) {
  process.exit(0);
}

let failedStep = "";

/**
 * @param {string} label
 * @param {() => number | void} fn returns exit code or void when ok
 */
function step(label, fn) {
  console.log(`\n\x1b[36m==>\x1b[0m ${label}\n`);
  const code = fn();
  if (code !== undefined && code !== 0) {
    failedStep = label;
    return false;
  }
  return true;
}

/**
 * @param {string} cmd
 * @param {string[]} args
 * @param {string} [cwd]
 */
function run(cmd, args, cwd = REPO_ROOT) {
  const result = spawnSync(cmd, args, { cwd, stdio: "inherit", env: process.env });
  return result.status ?? 1;
}

function failBanner() {
  const red = "\x1b[1;31m";
  const reset = "\x1b[0m";
  const bar = "═".repeat(72);
  process.stderr.write("\x07");
  console.error(`\n${red}${bar}`);
  console.error("  INTEGRITY CHECK FAILED");
  console.error(bar);
  console.error(`  Step : ${failedStep}`);
  console.error(`  Files: ${files.join(", ")}`);
  console.error(`${bar}${reset}\n`);
}

console.log(
  `\x1b[90m[integrity]\x1b[0m checking ${files.length} file(s): ${files.join(", ")}\n`,
);

if (
  !step("eslint (changed files)", () =>
    run("pnpm", ["exec", "eslint", "--max-warnings", "0", ...files]),
  )
) {
  failBanner();
  process.exit(1);
}

if (
  !step("depcruise (changed files)", () =>
    run("pnpm", [
      "exec",
      "depcruise",
      "--config",
      "dependency-cruiser.config.js",
      "--output-type",
      "err-long",
      ...files,
    ]),
  )
) {
  failBanner();
  process.exit(1);
}

if (
  !step("tsc (affected packages)", () =>
    run("node", ["scripts/precommit-tsc-staged.mjs", ...files]),
  )
) {
  failBanner();
  process.exit(1);
}

if (
  !step("test-pairing (subject files)", () => {
    const failures = [];
    for (const rel of files) {
      const abs = path.join(REPO_ROOT, rel);
      if (!fs.existsSync(abs)) continue;
      if (!isSubjectFile(rel)) continue;
      if (hasTestPair(abs)) continue;
      failures.push(formatTestPairMessage(rel));
    }
    if (failures.length === 0) return 0;
    console.error("Test-Pairing failed:\n");
    for (const message of failures) {
      console.error(`  • ${message}`);
    }
    return 1;
  })
) {
  failBanner();
  process.exit(1);
}

if (
  !step("unit tests (related specs)", () =>
    run("node", ["scripts/precommit-jest-staged.mjs", ...files]),
  )
) {
  failBanner();
  process.exit(1);
}

console.log("\n\x1b[32m[integrity]\x1b[0m all checks passed.\n");
process.exit(0);
