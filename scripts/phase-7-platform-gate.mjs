#!/usr/bin/env node
/**
 * Phase 7.9 — GHA platform DoD (REQ-P7-027).
 * Assumes ci:integrity + adversarial-p0 already green in the same workflow run.
 * Runs phase-6:guard + phase-7:guard without redundant full monorepo build/test chain.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function run(label, command, args) {
  console.log(`phase-7-platform-gate: ${label}…`);
  const r = spawnSync(command, args, {
    cwd: REPO_ROOT,
    encoding: "utf8",
    stdio: "inherit",
    shell: false,
  });
  if (r.status !== 0) {
    console.error(`phase-7-platform-gate: FAIL — ${label}`);
    process.exit(r.status ?? 1);
  }
}

function gitShortSha() {
  const r = spawnSync("git", ["rev-parse", "--short", "HEAD"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  return r.status === 0 ? r.stdout.trim() : "unknown";
}

function main() {
  const reportDate = process.env.PHASE_7_GATE_REPORT ?? new Date().toISOString().slice(0, 10);
  console.log(`phase-7-platform-gate: HEAD ${gitShortSha()}`);
  console.log(
    "phase-7-platform-gate: prerequisite — ci:integrity + adversarial-p0 (same workflow)",
  );

  if (process.env.PHASE_7_FULL_GATE === "1") {
    run("full phase-7:gate", "pnpm", ["run", "phase-7:gate"]);
    return;
  }

  run("phase-6:guard", "pnpm", ["run", "phase-6:guard"]);
  run("phase-7:guard", "pnpm", ["run", "phase-7:guard"]);

  const guardReport = path.join(REPO_ROOT, "reports", `phase-7-gate-${reportDate}.json`);
  if (!fs.existsSync(guardReport)) {
    console.error(`phase-7-platform-gate: missing ${guardReport}`);
    process.exit(1);
  }
  const parsed = JSON.parse(fs.readFileSync(guardReport, "utf8"));
  if (!parsed.ok) {
    console.error("phase-7-platform-gate: phase-7:guard report ok=false");
    process.exit(1);
  }

  const closureReport = {
    gate: "phase-7-platform",
    subphase: "7.9",
    date: reportDate,
    gitSha: gitShortSha(),
    ok: true,
    mode: "gha-platform-dod",
    prerequisites: ["ci-integrity", "adversarial-p0"],
    note: "phase-6:guard + phase-7:guard — nested build/test satisfied by ci:integrity",
  };
  const reportsDir = path.join(REPO_ROOT, "reports");
  fs.mkdirSync(reportsDir, { recursive: true });
  const outPath = path.join(reportsDir, `phase-7-platform-gate-${reportDate}.json`);
  fs.writeFileSync(outPath, `${JSON.stringify(closureReport, null, 2)}\n`);
  console.log(`phase-7-platform-gate: wrote ${outPath}`);
  console.log("phase-7-platform-gate: PASS");
}

main();
