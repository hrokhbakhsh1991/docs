#!/usr/bin/env node
/**
 * A4 — nightly 500-parallel pool storm + post-cooldown leak check.
 * @see docs/phase-5/appendices/pool-leak-post-storm-monitor.md
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ARTIFACT = path.join(ROOT, "test", "reliability", "pool-stress-500.last-run.json");
const STRESS_SCRIPT = path.join(ROOT, "scripts", "pool-stress-500-parallel.ts");

function writeArtifact(summary) {
  fs.mkdirSync(path.dirname(ARTIFACT), { recursive: true });
  fs.writeFileSync(ARTIFACT, `${JSON.stringify(summary, null, 2)}\n`);
}

function main() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    const summary = {
      gate: "pool-stress-500-nightly-probe",
      id: "A4",
      startedAt: new Date().toISOString(),
      verdict: "skipped",
      skippedReason: "DATABASE_URL unset — leak probe requires Postgres",
      connectionLeakSuspected: null,
      artifact: path.relative(ROOT, ARTIFACT),
    };
    writeArtifact(summary);
    console.log("pool-stress-500-nightly-probe: SKIP (no DATABASE_URL)");
    console.log(`  wrote ${summary.artifact}`);
    process.exit(0);
  }

  if (!fs.existsSync(STRESS_SCRIPT)) {
    console.error("pool-stress-500-nightly-probe: FAIL — pool-stress-500-parallel.ts missing");
    process.exit(1);
  }

  const startedAt = new Date().toISOString();
  const result = spawnSync(process.execPath, ["--import", "tsx", STRESS_SCRIPT], {
    cwd: ROOT,
    env: {
      ...process.env,
      NODE_ENV: "test",
      STORAGE_DRIVER: "prisma",
      P5_DB_HOLD_MS: process.env.P5_DB_HOLD_MS?.trim() ?? "250",
    },
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });

  let report;
  try {
    const stdout = result.stdout?.trim() ?? "";
    const jsonStart = stdout.indexOf("{");
    const jsonText = jsonStart >= 0 ? stdout.slice(jsonStart) : stdout;
    report = JSON.parse(jsonText);
  } catch (error) {
    console.error("pool-stress-500-nightly-probe: FAIL — could not parse stress report");
    if (result.stderr) {
      console.error(result.stderr);
    }
    process.exit(1);
  }

  const summary = {
    gate: "pool-stress-500-nightly-probe",
    id: "A4",
    startedAt,
    finishedAt: new Date().toISOString(),
    verdict: report.verdict ?? (result.status === 0 ? "pass" : "fail"),
    connectionLeakSuspected: report.connectionLeakSuspected ?? null,
    concurrent: report.concurrent,
    count503: report.count503,
    hung: report.hung,
    connectionsAfterCooldown: report.connectionsAfterCooldown,
    artifact: path.relative(ROOT, ARTIFACT),
    stressExitCode: result.status ?? 1,
  };

  writeArtifact(summary);

  if (summary.connectionLeakSuspected === true) {
    console.error("pool-stress-500-nightly-probe: FAIL — connectionLeakSuspected=true");
    console.error(`  wrote ${summary.artifact}`);
    process.exit(1);
  }

  if (summary.verdict !== "pass") {
    console.error(`pool-stress-500-nightly-probe: FAIL — verdict=${summary.verdict}`);
    console.error(`  wrote ${summary.artifact}`);
    process.exit(1);
  }

  console.log(
    `pool-stress-500-nightly-probe: PASS concurrent=${summary.concurrent} count503=${summary.count503} leak=false`
  );
  console.log(`  wrote ${summary.artifact}`);
}

main();
