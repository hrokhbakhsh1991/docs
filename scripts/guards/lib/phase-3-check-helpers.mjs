/**
 * Shared Phase 3 check helpers (static guard + apps-cert).
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { evaluatePackageTestRun } from "./parse-test-output.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(__dirname, "../../..");
export const REPORTS_DIR = path.join(REPO_ROOT, "reports");
const DETAIL_MAX = 2000;

/** @typedef {{ id: string, enforcementId?: string, description: string, required: boolean, ok: boolean, detail?: string | null }} GuardCheck */

export function gitShortSha() {
  const r = spawnSync("git", ["rev-parse", "--short", "HEAD"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  return r.status === 0 ? r.stdout.trim() : "unknown";
}

export function truncateDetail(text) {
  if (text == null) return null;
  const t = String(text).trim();
  if (t.length <= DETAIL_MAX) return t;
  return `${t.slice(0, DETAIL_MAX)}\n… (truncated)`;
}

export function runPnpm(args, cwd = REPO_ROOT) {
  return spawnSync("pnpm", args, {
    cwd,
    encoding: "utf8",
    shell: true,
    maxBuffer: 16 * 1024 * 1024,
  });
}

/** @returns {GuardCheck} */
export function checkCommand(id, enforcementId, description, args, required = true) {
  const r = runPnpm(args);
  const ok = r.status === 0;
  return {
    id,
    enforcementId,
    description,
    required,
    ok,
    detail: ok ? null : truncateDetail(`${r.stdout ?? ""}${r.stderr ?? ""}`),
  };
}

/** @returns {GuardCheck} */
export function checkPackageTests(filter, minCount, id, enforcementId, description) {
  const r = runPnpm(["--filter", filter, "run", "test"]);
  const { ok, count, output } = evaluatePackageTestRun(r, minCount);
  return {
    id,
    enforcementId,
    description: `${description} (enforced count)`,
    required: true,
    ok,
    detail: ok
      ? `${count} tests`
      : truncateDetail(
          count != null ? `${count} tests (need ≥ ${minCount})\n${output}` : `could not parse test count\n${output}`,
        ),
  };
}

/**
 * @param {object} opts
 * @param {string} opts.baseName
 * @param {string} opts.phase
 * @param {string} opts.reportDate
 * @param {string} opts.gateCommand
 * @param {string} opts.doc
 * @param {string} opts.note
 * @param {string} opts.logPrefix
 * @param {GuardCheck[]} opts.checks
 */
export function writePhase3Report(opts) {
  const { baseName, phase, reportDate, gateCommand, doc, note, logPrefix, checks } = opts;
  const requiredOk = checks.filter((c) => c.required).every((c) => c.ok);

  const report = {
    generatedAt: new Date().toISOString(),
    gitSha: gitShortSha(),
    phase,
    reportDate,
    enforcement: {
      doc,
      gateCommand,
    },
    checks,
    exit: {
      pass: requiredOk,
      requiredTotal: checks.filter((c) => c.required).length,
      requiredPassed: checks.filter((c) => c.required && c.ok).length,
      optionalTotal: checks.filter((c) => !c.required).length,
      note,
    },
  };

  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const jsonPath = path.join(REPORTS_DIR, `${baseName}.json`);
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

  console.log(`${logPrefix}: wrote ${path.relative(REPO_ROOT, jsonPath)}`);
  console.log(`${logPrefix}: ${requiredOk ? "PASS" : "FAIL"}`);
  for (const c of checks) {
    console.log(`  ${c.ok ? "✓" : "✗"} ${c.id}${c.enforcementId ? ` (${c.enforcementId})` : ""}`);
    if (!c.ok && c.detail) {
      console.log(`      ${String(c.detail).split("\n").join("\n      ")}`);
    }
  }

  if (!requiredOk) {
    process.exit(1);
  }
}
