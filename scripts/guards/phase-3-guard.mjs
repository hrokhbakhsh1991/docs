#!/usr/bin/env node
/**
 * Phase 3.5 — final gate (§13 phase-3-design-system.md).
 * Usage: node scripts/guards/phase-3-guard.mjs
 * Env: PHASE_3_GATE_REPORT=2026-06-03 (optional report date slug)
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  APPS_API_TEST_MIN,
  APPS_WEB_TEST_MIN,
  WORKSPACE_SDK_TEST_MIN,
  WORKSPACE_STARTER_TEST_MIN,
} from "./gate-thresholds.mjs";
import { evaluatePackageTestRun } from "./lib/parse-test-output.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const REPORTS_DIR = path.join(REPO_ROOT, "reports");
const REPORT_DATE =
  process.env.PHASE_3_GATE_REPORT ?? new Date().toISOString().slice(0, 10);
const DETAIL_MAX = 2000;

const PHASE3_SCAN_PATHS = [
  path.join(REPO_ROOT, "apps"),
  path.join(REPO_ROOT, "packages/workspace-sdk"),
  path.join(REPO_ROOT, "packages/platform-core"),
  path.join(REPO_ROOT, "packages/workspaces/starter"),
  path.join(REPO_ROOT, "packages/theme-react"),
  path.join(REPO_ROOT, "packages/ui-primitives"),
];

const MIN_WORKSPACE_SDK_TESTS = WORKSPACE_SDK_TEST_MIN.phase3;
const MIN_STARTER_TESTS = WORKSPACE_STARTER_TEST_MIN.phase3;
const MIN_API_TESTS = APPS_API_TEST_MIN.phase3;
const MIN_WEB_TESTS = APPS_WEB_TEST_MIN.phase3;

/** @typedef {{ id: string, enforcementId?: string, description: string, required: boolean, ok: boolean, detail?: string | null }} GuardCheck */

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

function parseTestCount(output) {
  const matches = [...String(output).matchAll(/[#ℹ] tests (\d+)/g)];
  if (matches.length === 0) return null;
  return Number.parseInt(matches[matches.length - 1][1], 10);
}

function runPnpm(args, cwd = REPO_ROOT) {
  return spawnSync("pnpm", args, {
    cwd,
    encoding: "utf8",
    shell: true,
    maxBuffer: 16 * 1024 * 1024,
  });
}

function runNode(scriptRel) {
  return spawnSync("node", [path.join(REPO_ROOT, scriptRel)], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });
}

function rg(args, searchPaths) {
  const paths = (Array.isArray(searchPaths) ? searchPaths : [searchPaths]).filter((p) =>
    fs.existsSync(p),
  );
  if (paths.length === 0) return { lines: [] };
  const r = spawnSync("rg", [...args, ...paths], { cwd: REPO_ROOT, encoding: "utf8" });
  const lines = (r.stdout ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  return { lines };
}

/** @returns {GuardCheck} */
function checkCommand(id, enforcementId, description, args, required = true) {
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
function checkPackageTests(filter, minCount, id, enforcementId, description) {
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

/** @returns {GuardCheck} */
function checkUiPrimitivesSubpathsOptional() {
  const pkgPath = path.join(REPO_ROOT, "packages/ui-primitives/package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  const exports = Object.keys(pkg.exports ?? {});
  const hasSelect = exports.includes("./select");
  const hasCheckbox = exports.includes("./checkbox");
  const ok = true;
  return {
    id: "p3_ui_select_checkbox_optional",
    enforcementId: "P3-UI-01/02",
    description: "Select/Checkbox subpaths (optional until 3.3.x)",
    required: false,
    ok,
    detail: `select=${hasSelect} checkbox=${hasCheckbox}`,
  };
}

const DENALI_CORE_SCAN_ROOTS = [
  "packages/platform-core/src",
  "packages/workspaces/starter/src",
  "packages/theme-react/src",
  "packages/ui-primitives/src",
];

const DENALI_SOURCE_FILE = /\.(ts|tsx|js|jsx|mjs|cjs)$/i;
const DENALI_SPEC_FILE = /\.spec\.(ts|tsx)$/i;
const DENALI_PATTERN = /denali/i;

function listDenaliCoreSourceFiles(rootDir, out = []) {
  if (!fs.existsSync(rootDir)) return out;
  for (const ent of fs.readdirSync(rootDir, { withFileTypes: true })) {
    const full = path.join(rootDir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "test" || ent.name === "node_modules" || ent.name === "dist") continue;
      listDenaliCoreSourceFiles(full, out);
      continue;
    }
    if (!DENALI_SOURCE_FILE.test(ent.name) || DENALI_SPEC_FILE.test(ent.name)) continue;
    out.push(full);
  }
  return out;
}

function findDenaliCoreHits() {
  const hits = [];
  for (const rel of DENALI_CORE_SCAN_ROOTS) {
    const root = path.join(REPO_ROOT, rel);
    for (const file of listDenaliCoreSourceFiles(root)) {
      const text = fs.readFileSync(file, "utf8");
      if (!DENALI_PATTERN.test(text)) continue;
      const relFile = path.relative(REPO_ROOT, file);
      const line = text.split("\n").findIndex((row) => DENALI_PATTERN.test(row)) + 1;
      hits.push(`${relFile}:${line}`);
    }
  }
  return hits;
}

/** @returns {GuardCheck} */
function checkNoDenaliInPhase3Scope() {
  // Phase 6+ — Denali lives under packages/workspaces/denali and approved apps/web|api
  // wiring; kernel + design-system packages stay Denali-free (P3-E-WS-01 / no core creep).
  const hits = findDenaliCoreHits();
  const ok = hits.length === 0;
  return {
    id: "p3_no_denali",
    enforcementId: "P3-E-WS-01",
    description:
      "denali-free scan: platform-core/starter/theme-react/ui-primitives src (Phase 6 apps/sdk exempt)",
    required: true,
    ok,
    detail: ok ? null : truncateDetail(hits.join("\n")),
  };
}

/** @returns {GuardCheck} */
function checkAppsWebExists() {
  const ok = fs.existsSync(path.join(REPO_ROOT, "apps/web/package.json"));
  return {
    id: "p3_apps_web_exists",
    enforcementId: "P3-E-APP-HOOK",
    description: "apps/web package exists",
    required: true,
    ok,
    detail: null,
  };
}

/** @returns {GuardCheck} */
function checkAppsApiExists() {
  const ok = fs.existsSync(path.join(REPO_ROOT, "apps/api/package.json"));
  return {
    id: "p3_apps_api_exists",
    enforcementId: "P3-E-DB-01",
    description: "apps/api package exists",
    required: true,
    ok,
    detail: null,
  };
}

function main() {
  const checks = [
    checkCommand(
      "p3_doc_gate",
      "P3-E-DOC-GATE",
      "pnpm run doc-gate (Docs-as-Code scaffold — required before 3.1)",
      ["run", "doc-gate"],
    ),
    checkAppsWebExists(),
    checkAppsApiExists(),
    checkCommand(
      "p3_apps_web_lint",
      "P3-E-APP-HOOK",
      "pnpm --filter @apps/web run lint (prelint guards)",
      ["--filter", "@apps/web", "run", "lint"],
    ),
    checkCommand(
      "p3_audit_boundary",
      "P3-E-BARREL",
      "pnpm run audit-boundary",
      ["run", "audit-boundary"],
    ),
    checkCommand(
      "p3_import_boundary",
      "P3-E-BARREL",
      "pnpm run guard:import-boundary",
      ["run", "guard:import-boundary"],
    ),
    checkCommand(
      "p3_guard_architecture",
      "P3-E-WS-01",
      "pnpm run guard:architecture",
      ["run", "guard:architecture"],
    ),
    checkCommand(
      "p3_artifact_surface",
      "P3-E-ARTIFACT",
      "pnpm run guard:artifact-surface",
      ["run", "guard:artifact-surface"],
    ),
    checkPackageTests(
      "@app-tour/workspace-sdk",
      MIN_WORKSPACE_SDK_TESTS,
      "p3_workspace_sdk_tests",
      "P3-E-CASL-01",
      `workspace-sdk tests ≥ ${MIN_WORKSPACE_SDK_TESTS}`,
    ),
    checkCommand(
      "p3_starter_build",
      "P3-E-WS-01",
      "pnpm --filter @app-tour/workspace-starter run build",
      ["--filter", "@app-tour/workspace-starter", "run", "build"],
    ),
    checkPackageTests(
      "@app-tour/workspace-starter",
      MIN_STARTER_TESTS,
      "p3_starter_tests",
      "P3-E-WS-01",
      `workspace-starter tests ≥ ${MIN_STARTER_TESTS}`,
    ),
    checkCommand(
      "p3_theme_react_verify_exports",
      "P3-E-L01",
      "pnpm --filter @app-tour/theme-react run verify:exports",
      ["--filter", "@app-tour/theme-react", "run", "verify:exports"],
    ),
    checkCommand(
      "p3_api_gate",
      "P3-E-DB-01",
      "pnpm --filter @apps/api run phase-3:api-gate",
      ["--filter", "@apps/api", "run", "phase-3:api-gate"],
    ),
    checkCommand(
      "p3_web_gate",
      "P3-E-APP-HOOK",
      "pnpm --filter @apps/web run phase-3:web-gate",
      ["--filter", "@apps/web", "run", "phase-3:web-gate"],
    ),
    checkCommand(
      "p3_canonical_sync",
      "P3-E-CANONICAL-34",
      "apps/api validate:canonical-sync",
      ["--filter", "@apps/api", "run", "validate:canonical-sync"],
    ),
    checkUiPrimitivesSubpathsOptional(),
    checkNoDenaliInPhase3Scope(),
  ];

  const requiredOk = checks.filter((c) => c.required).every((c) => c.ok);
  const baseName = `phase-3-gate-${REPORT_DATE}`;

  const report = {
    generatedAt: new Date().toISOString(),
    gitSha: gitShortSha(),
    phase: "3.5",
    reportDate: REPORT_DATE,
    enforcement: {
      doc: "docs/phase-3-design-system.md §13",
      gateCommand: "pnpm run phase-3:gate",
    },
    checks,
    exit: {
      pass: requiredOk,
      requiredTotal: checks.filter((c) => c.required).length,
      requiredPassed: checks.filter((c) => c.required && c.ok).length,
      optionalTotal: checks.filter((c) => !c.required).length,
      note: "Phase 3 close — CASL, canonical SoT, apps/api+web, barrel, artifact surface",
    },
  };

  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const jsonPath = path.join(REPORTS_DIR, `${baseName}.json`);
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

  console.log(`phase-3-guard: wrote ${path.relative(REPO_ROOT, jsonPath)}`);
  console.log(`phase-3-guard: ${requiredOk ? "PASS" : "FAIL"}`);
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

main();
