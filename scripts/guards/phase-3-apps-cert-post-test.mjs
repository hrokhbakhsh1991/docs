#!/usr/bin/env node
/**
 * Phase 3 — apps-cert post-test mode (additive residual certification).
 *
 * Use ONLY after root monorepo build && test with PHASE_3_APPS_CERT_INHERIT_ROOT=1.
 * Full standalone certification remains: pnpm run phase-3:apps-cert
 *
 * Does NOT invoke api/web leaf certification gates, root monorepo build, or root monorepo test.
 * Does NOT claim sdk/starter floors or api/web gate composites.
 *
 * @see docs/phase-3/phase-3-guard-apps-cert-split.mdoc
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const REPORTS_DIR = path.join(REPO_ROOT, "reports");
const DETAIL_MAX = 4000;
const REPORT_DATE =
  process.env.PHASE_3_APPS_CERT_POST_TEST_REPORT ??
  process.env.PHASE_3_APPS_CERT_REPORT ??
  process.env.PHASE_3_GATE_REPORT ??
  new Date().toISOString().slice(0, 10);

const INHERIT_ENV = "PHASE_3_APPS_CERT_INHERIT_ROOT";

/** @typedef {{ id: string, enforcementId?: string, description: string, ok: boolean, detail?: string | null }} ExecutedCheck */
/** @typedef {{ id: string, owner?: string, detail: string }} InheritedOrSkipped */

function gitShortSha() {
  const r = spawnSync("git", ["rev-parse", "--short", "HEAD"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  return r.status === 0 ? r.stdout.trim() : "unknown";
}

function truncateDetail(text) {
  if (text == null) return null;
  const t = String(text).trim();
  if (t.length <= DETAIL_MAX) return t;
  return `${t.slice(0, DETAIL_MAX)}\n… (truncated)`;
}

/**
 * @param {string[]} args
 * @param {NodeJS.ProcessEnv} [extraEnv]
 */
function runPnpm(args, extraEnv = {}) {
  return spawnSync("pnpm", args, {
    cwd: REPO_ROOT,
    encoding: "utf8",
    shell: true,
    maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, ...extraEnv },
  });
}

/**
 * @param {string} id
 * @param {string} enforcementId
 * @param {string} description
 * @param {string[]} args
 * @param {NodeJS.ProcessEnv} [extraEnv]
 * @returns {ExecutedCheck}
 */
function runExecuted(id, enforcementId, description, args, extraEnv = {}) {
  console.log(`phase-3-apps-cert-post-test: ${id}…`);
  const r = runPnpm(args, extraEnv);
  const ok = r.status === 0;
  return {
    id,
    enforcementId,
    description,
    ok,
    detail: ok ? null : truncateDetail(`${r.stdout ?? ""}${r.stderr ?? ""}`),
  };
}

function main() {
  if (process.env[INHERIT_ENV]?.trim() !== "1") {
    console.error(
      `phase-3-apps-cert-post-test: FAIL — ${INHERIT_ENV}=1 required.\n` +
        `Use the full standalone apps-cert command, or run this only after root monorepo build && test with ${INHERIT_ENV}=1`,
    );
    process.exit(1);
  }

  /** @type {ExecutedCheck[]} */
  const executed = [
    runExecuted(
      "p3_apps_web_lint",
      "P3-E-APP-HOOK",
      "pnpm --filter @apps/web run lint (prelint lifecycle + eslint + tsc)",
      ["--filter", "@apps/web", "run", "lint"],
    ),
    runExecuted(
      "p3_canonical_sync",
      "P3-E-CANONICAL-34",
      "pnpm --filter @apps/api run validate:canonical-sync",
      ["--filter", "@apps/api", "run", "validate:canonical-sync"],
    ),
    runExecuted(
      "p3_apps_web_next_build",
      "P3-E-APP-HOOK",
      "WEB_SKIP_GUARD_PREBUILD=1 pnpm --filter @apps/web run build (admin next build; not in root monorepo build)",
      ["--filter", "@apps/web", "run", "build"],
      { WEB_SKIP_GUARD_PREBUILD: "1" },
    ),
  ];

  /** @type {InheritedOrSkipped[]} */
  const inherited = [
    {
      id: "root_build",
      owner: "root monorepo build",
      detail: "caller contract — not re-executed by this runner",
    },
    {
      id: "root_test",
      owner: "root monorepo test",
      detail:
        "caller contract — includes sdk, starter, api(+pretest), web suites; not re-executed",
    },
  ];

  /** @type {InheritedOrSkipped[]} */
  const skipped_by_contract = [
    {
      id: "p3_workspace_sdk_tests",
      detail: "sdk suite owned by root monorepo test — not re-executed",
    },
    {
      id: "p3_starter_build",
      detail: "starter build owned by root monorepo build — not re-executed",
    },
    {
      id: "p3_starter_tests",
      detail: "starter suite owned by root monorepo test — not re-executed",
    },
    {
      id: "p3_api_gate",
      detail:
        "api leaf certification gate not invoked — api build/test/guards owned by root build+test; not equivalent to that gate PASS",
    },
    {
      id: "api_build_prebuild",
      detail: "api prebuild/build owned by root monorepo build — not re-executed",
    },
    {
      id: "api_test_and_pretest_guards",
      detail: "api test + pretest guards owned by root monorepo test — not re-executed",
    },
    {
      id: "p3_web_gate",
      detail:
        "web leaf certification gate not invoked — replaced by lint-once + next build; web unit suite owned by root test",
    },
    {
      id: "web_unit_tests",
      detail: "web unit suite owned by root monorepo test — not re-executed",
    },
  ];

  const not_enforced_in_this_mode = [
    {
      id: "sdk_starter_count_floors",
      detail:
        "Root test proves exit 0 only; sdk/starter ≥ floors owned by phase-3:apps-cert:floors (standalone full apps-cert also enforces via checkPackageTests)",
    },
    {
      id: "api_leaf_gate_composite",
      detail: "Post-test does not emit api leaf-gate PASS; canonical-sync is executed separately",
    },
    {
      id: "web_leaf_gate_composite",
      detail: "Post-test does not emit web leaf-gate PASS; lint + next build are executed separately",
    },
  ];

  const executedFailed = executed.filter((c) => !c.ok);
  const pass = executedFailed.length === 0;

  const report = {
    mode: "post-test",
    generatedAt: new Date().toISOString(),
    gitSha: gitShortSha(),
    reportDate: REPORT_DATE,
    gateCommand: "pnpm run phase-3:apps-cert:post-test",
    enforcement: {
      doc: "docs/phase-3/phase-3-guard-apps-cert-split.mdoc",
    },
    contract: {
      requireEnv: `${INHERIT_ENV}=1`,
      assumes: ["root monorepo build exit 0", "root monorepo test exit 0"],
    },
    inherited,
    executed,
    skipped_by_contract,
    not_enforced_in_this_mode,
    exit: {
      pass,
      executedTotal: executed.length,
      executedPassed: executed.filter((c) => c.ok).length,
      note: "Residual post-root cert only — NOT equivalent to full standalone apps-cert PASS",
    },
  };

  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const reportPath = path.join(REPORTS_DIR, `phase-3-apps-cert-post-test-${REPORT_DATE}.json`);
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  console.log(`phase-3-apps-cert-post-test: wrote ${path.relative(REPO_ROOT, reportPath)}`);
  console.log(`phase-3-apps-cert-post-test: ${pass ? "PASS" : "FAIL"}`);
  for (const c of executed) {
    console.log(`  executed ${c.ok ? "✓" : "✗"} ${c.id}`);
    if (!c.ok && c.detail) {
      console.log(`      ${String(c.detail).split("\n").join("\n      ")}`);
    }
  }
  for (const row of skipped_by_contract) {
    console.log(`  skipped_by_contract · ${row.id}`);
  }

  if (!pass) {
    process.exit(1);
  }
}

main();
