#!/usr/bin/env node
/**
 * Phase 3 — apps-cert floors probe (additive).
 *
 * Proves workspace-sdk + workspace-starter test-count floors only.
 * Requires PHASE_3_APPS_CERT_INHERIT_ROOT=1 after a successful root monorepo
 * build && test. Does not re-run those, does not invoke leaf api/web gates,
 * and does not claim their composites.
 *
 * Package selection uses path filters (`./packages/...`) so selection does not
 * depend on scoped `--filter` typos (`@app-cloud` is forbidden; canonical scope
 * is `@app-tour`). See scripts/guards/guard-no-app-cloud-imports.mjs.
 *
 * Thresholds: WORKSPACE_SDK_TEST_MIN.phase3 / WORKSPACE_STARTER_TEST_MIN.phase3
 * via evaluatePackageTestRun (same helpers as full standalone apps certification).
 *
 * @see docs/phase-3/phase-3-guard-apps-cert-split.mdoc
 */
import fs from "node:fs";
import path from "node:path";

import {
  WORKSPACE_SDK_TEST_MIN,
  WORKSPACE_STARTER_TEST_MIN,
} from "./gate-thresholds.mjs";
import { evaluatePackageTestRun } from "./lib/parse-test-output.mjs";
import { REPO_ROOT, REPORTS_DIR, gitShortSha, truncateDetail, runPnpm } from "./lib/phase-3-check-helpers.mjs";

const REPORT_DATE =
  process.env.PHASE_3_APPS_CERT_FLOORS_REPORT ??
  process.env.PHASE_3_APPS_CERT_REPORT ??
  process.env.PHASE_3_GATE_REPORT ??
  new Date().toISOString().slice(0, 10);

const INHERIT_ENV = "PHASE_3_APPS_CERT_INHERIT_ROOT";
const SDK_FLOOR = WORKSPACE_SDK_TEST_MIN.phase3;
const STARTER_FLOOR = WORKSPACE_STARTER_TEST_MIN.phase3;

/**
 * @param {string} filter
 * @param {number} minCount
 * @param {string} id
 * @param {string} enforcementId
 */
function runFloor(filter, minCount, id, enforcementId) {
  console.log(`phase-3-apps-cert-floors: ${id} (≥${minCount})…`);
  const r = runPnpm(["--filter", filter, "run", "test"]);
  const { ok, count, output } = evaluatePackageTestRun(r, minCount);
  return {
    id,
    enforcementId,
    filter,
    threshold: minCount,
    ok,
    count,
    result:
      ok && count != null
        ? `${count} tests (≥ ${minCount})`
        : truncateDetail(
            count != null
              ? `${count} tests (need ≥ ${minCount})\n${output}`
              : `could not parse test count\n${output}`,
          ),
  };
}

function main() {
  if (process.env[INHERIT_ENV]?.trim() !== "1") {
    console.error(
      `phase-3-apps-cert-floors: FAIL — ${INHERIT_ENV}=1 required.\n` +
        `This command requires a prior successful root monorepo build && test.\n` +
        `Set ${INHERIT_ENV}=1 only after those exit 0, or use the full standalone apps certification command.`,
    );
    process.exit(1);
  }

  const executed = [
    runFloor(
      "./packages/workspace-sdk",
      SDK_FLOOR,
      "workspace_sdk_test_floor",
      "P3-E-CASL-01",
    ),
    runFloor(
      "./packages/workspaces/starter",
      STARTER_FLOOR,
      "starter_test_floor",
      "P3-E-WS-01",
    ),
  ];

  const inherited = [
    { id: "root_build", detail: "not re-executed" },
    { id: "root_test", detail: "not re-executed" },
  ];

  const not_enforced_in_this_mode = [
    "api test count docs",
    "web test count docs",
    "api-gate composite",
    "web-gate composite",
  ];

  const pass = executed.every((c) => c.ok);

  const report = {
    mode: "floors",
    generatedAt: new Date().toISOString(),
    gitSha: gitShortSha(),
    reportDate: REPORT_DATE,
    gateCommand: "pnpm run phase-3:apps-cert:floors",
    enforcement: {
      doc: "docs/phase-3/phase-3-guard-apps-cert-split.mdoc",
    },
    contract: {
      requireEnv: `${INHERIT_ENV}=1`,
      assumes: ["root monorepo build exit 0", "root monorepo test exit 0"],
    },
    executed,
    inherited,
    not_enforced_in_this_mode,
    exit: {
      pass,
      executedTotal: executed.length,
      executedPassed: executed.filter((c) => c.ok).length,
      note: "Sdk+starter count floors only — NOT equivalent to full standalone apps certification; api/web composites not claimed",
    },
  };

  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const reportPath = path.join(REPORTS_DIR, `phase-3-apps-cert-floors-${REPORT_DATE}.json`);
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  console.log(`phase-3-apps-cert-floors: wrote ${path.relative(REPO_ROOT, reportPath)}`);
  console.log(`phase-3-apps-cert-floors: ${pass ? "PASS" : "FAIL"}`);
  for (const c of executed) {
    console.log(`  executed ${c.ok ? "✓" : "✗"} ${c.id} ${c.result ?? ""}`);
  }
  for (const row of inherited) {
    console.log(`  inherited · ${row.id} (${row.detail})`);
  }
  for (const item of not_enforced_in_this_mode) {
    console.log(`  not_enforced · ${item}`);
  }

  if (!pass) {
    process.exit(1);
  }
}

main();
