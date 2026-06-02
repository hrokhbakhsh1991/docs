#!/usr/bin/env node
/**
 * Continuous Integrity Watcher — runs incremental integrity checks on save.
 *
 * Watches apps and packages src trees (plus apps/web/lib). Start via:
 *   pnpm run dev:integrity
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import chokidar from "chokidar";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

const WATCH_GLOBS = [
  "apps/*/src/**/*.{ts,tsx,js,jsx,mjs,cjs}",
  "packages/*/src/**/*.{ts,tsx,js,jsx,mjs,cjs}",
  "apps/web/lib/**/*.{ts,tsx,js,jsx,mjs,cjs}",
];

const IGNORED = [
  "**/node_modules/**",
  "**/dist/**",
  "**/.next/**",
  "**/coverage/**",
  "**/*.d.ts",
];

const DEBOUNCE_MS = 400;

/** @type {ReturnType<typeof setTimeout> | undefined} */
let debounceTimer;
/** @type {Set<string>} */
const pending = new Set();
/** @type {import('node:child_process').ChildProcess | null} */
let activeRun = null;

function toRepoRelative(absPath) {
  return path.relative(REPO_ROOT, absPath).replace(/\\/g, "/");
}

function scheduleRun(absPath) {
  pending.add(toRepoRelative(absPath));
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(flushRun, DEBOUNCE_MS);
}

function flushRun() {
  debounceTimer = undefined;
  const files = [...pending];
  pending.clear();
  if (files.length === 0) return;

  if (activeRun) {
    activeRun.kill("SIGTERM");
    activeRun = null;
  }

  const stamp = new Date().toISOString().slice(11, 19);
  console.log(
    `\n\x1b[35m[dev:integrity ${stamp}]\x1b[0m save detected — running checks…`,
  );

  activeRun = spawn(
    process.execPath,
    ["scripts/run-integrity-for-changed.mjs", ...files],
    {
      cwd: REPO_ROOT,
      stdio: "inherit",
      env: process.env,
    },
  );

  activeRun.on("close", (code) => {
    activeRun = null;
    if (code !== 0) {
      console.error(
        "\x1b[1;31m[dev:integrity]\x1b[0m Fix the errors above before committing.\n",
      );
    }
  });
}

const watcher = chokidar.watch(WATCH_GLOBS, {
  cwd: REPO_ROOT,
  ignored: IGNORED,
  ignoreInitial: true,
  awaitWriteFinish: { stabilityThreshold: 150, pollInterval: 50 },
});

watcher.on("add", (p) => scheduleRun(path.join(REPO_ROOT, p)));
watcher.on("change", (p) => scheduleRun(path.join(REPO_ROOT, p)));

console.log("\x1b[32mContinuous Integrity Watcher\x1b[0m");
console.log("Watching src/ trees — save a file to run eslint, depcruise, tsc, and tests.");
console.log(`Globs: ${WATCH_GLOBS.join(", ")}\n`);

process.on("SIGINT", () => {
  watcher.close().then(() => process.exit(0));
});
