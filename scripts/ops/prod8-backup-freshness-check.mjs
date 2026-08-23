#!/usr/bin/env node
/** PROD-8 R8-25 — backup freshness monitor (local/SSH-less check of dump directory policy). */
import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const dumpDir = process.env.PRE_MIGRATE_DUMP_DIR || "/var/backups/app-cloud";
const maxAgeHours = Number(process.env.PROD8_BACKUP_MAX_AGE_HOURS || "24");

const report = {
  schema_version: "prod8-backup-freshness.1",
  checked_at: new Date().toISOString(),
  dump_dir: dumpDir,
  max_age_hours: maxAgeHours,
  latest_dump: null,
  age_hours: null,
  status: "SKIP",
  blocks_production_acceptance: true,
  environment_applicable: false,
};

if (!existsSync(dumpDir)) {
  report.status = "SKIP";
  report.reason = `dump directory not accessible locally: ${dumpDir}`;
  report.environment_applicable = false;
} else {
  report.environment_applicable = true;
  const dumps = readdirSync(dumpDir)
    .filter((name) => name.startsWith("pre-migrate-") && name.endsWith(".dump"))
    .map((name) => {
      const abs = join(dumpDir, name);
      const mtime = statSync(abs).mtimeMs;
      return { name, abs, mtime };
    })
    .sort((a, b) => b.mtime - a.mtime);

  if (dumps.length === 0) {
    report.status = "FAIL";
    report.reason = "no pre-migrate dumps found";
  } else {
    const latest = dumps[0];
    const ageHours = (Date.now() - latest.mtime) / 3_600_000;
    report.latest_dump = latest.name;
    report.age_hours = Number(ageHours.toFixed(2));
    report.status = ageHours <= maxAgeHours ? "PASS" : "WARN";
    if (report.status === "WARN") {
      report.reason = `latest dump older than ${maxAgeHours}h`;
    }
  }
}

import { mkdirSync, writeFileSync } from "node:fs";
const outDir = join(root, ".artifacts/prod8");
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "backup-freshness.json"), `${JSON.stringify(report, null, 2)}\n`);

const code = report.status === "FAIL" ? 1 : 0;
console.log(
  `prod8-backup-freshness: ${report.status} — dir=${dumpDir} latest=${report.latest_dump ?? "none"} blocks_production=${report.blocks_production_acceptance}`,
);
process.exit(code);
