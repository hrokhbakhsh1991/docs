#!/usr/bin/env node
/**
 * Phase 2.5 — design system gate (primitives build, theme contracts, visual tests).
 * Usage: node scripts/guards/phase-2-guard.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  DESIGN_TOKENS_TEST_MIN,
  PHASE_2_BEHAVIOR_CONTRACT_MIN,
  THEME_REACT_TEST_MIN,
  UI_PRIMITIVES_TEST_MIN,
  UI_PRIMITIVES_VISUAL_TEST_MIN,
  WORKSPACE_SDK_TEST_MIN,
} from "./gate-thresholds.mjs";
import {
  evaluatePackageTestRun,
  outputHasTestFailures,
  parseTestCount,
} from "./lib/parse-test-output.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const REPORTS_DIR = path.join(REPO_ROOT, "reports");
const DESIGN_TOKENS_DIST_CSS = path.join(
  REPO_ROOT,
  "packages/design-tokens/dist/index.css",
);
const UI_PRIMITIVES_DIST = path.join(REPO_ROOT, "packages/ui-primitives/dist/Button/Button.js");
const THEME_REACT_DIST = path.join(REPO_ROOT, "packages/theme-react/dist/index.js");
const PHASE2_SCAN_DIRS = [
  path.join(REPO_ROOT, "packages/design-tokens/src"),
  path.join(REPO_ROOT, "packages/ui-primitives/src"),
  path.join(REPO_ROOT, "packages/theme-react/src"),
];
const MIN_WORKSPACE_SDK_TESTS = WORKSPACE_SDK_TEST_MIN.phase2;
const MIN_UI_PRIMITIVES_TESTS = UI_PRIMITIVES_TEST_MIN.phase2;
const MIN_THEME_REACT_TESTS = THEME_REACT_TEST_MIN.phase2;
const MIN_VISUAL_TESTS = UI_PRIMITIVES_VISUAL_TEST_MIN.phase2;
const MIN_DESIGN_TOKENS_TESTS = DESIGN_TOKENS_TEST_MIN.phase2;
const PHASE_2_CONTRACT_SPEC = "packages/platform-core/test/phase-2.contract.spec.ts";
const DETAIL_MAX = 2000;

/** @typedef {{ id: string, description: string, required: boolean, ok: boolean, detail?: string | null }} GuardCheck */

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

function runPnpm(args) {
  return spawnSync("pnpm", args, {
    cwd: REPO_ROOT,
    encoding: "utf8",
    shell: true,
    maxBuffer: 16 * 1024 * 1024,
  });
}

function rg(args, searchPaths) {
  const paths = (Array.isArray(searchPaths) ? searchPaths : [searchPaths]).filter((p) =>
    fs.existsSync(p),
  );
  if (paths.length === 0) {
    return { exitCode: 0, lines: [] };
  }
  const r = spawnSync("rg", [...args, ...paths], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  const lines = (r.stdout ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return { exitCode: r.status ?? 1, lines };
}

/** @returns {GuardCheck} */
function checkDesignTokensDist() {
  const ok = fs.existsSync(DESIGN_TOKENS_DIST_CSS);
  return {
    id: "p2_design_tokens_dist",
    description: "design-tokens dist/index.css exists",
    required: true,
    ok,
    detail: ok ? null : "run pnpm --filter @app-tour/design-tokens build",
  };
}

/** @returns {GuardCheck} */
function checkValidateDesignTokens() {
  const r = runPnpm(["run", "validate-design-tokens"]);
  const ok = r.status === 0;
  return {
    id: "p2_validate_design_tokens",
    description: "pnpm run validate-design-tokens",
    required: true,
    ok,
    detail: ok ? null : truncateDetail((r.stdout ?? "") + (r.stderr ?? "")),
  };
}

/** @returns {GuardCheck} */
function checkDesignTokensTests() {
  const r = runPnpm(["--filter", "@app-tour/design-tokens", "run", "test"]);
  const { ok, count, output } = evaluatePackageTestRun(r, MIN_DESIGN_TOKENS_TESTS);
  return {
    id: "p2_design_tokens_tests",
    description: `design-tokens tests ≥ ${MIN_DESIGN_TOKENS_TESTS} (tokens.meta.json contract)`,
    required: true,
    ok,
    detail: ok
      ? `${count} tests`
      : truncateDetail(
          count != null
            ? `${count} tests (need ≥ ${MIN_DESIGN_TOKENS_TESTS})\n${output}`
            : output,
        ),
  };
}

/** @returns {GuardCheck} */
function checkUiPrimitivesBuild() {
  const ok = fs.existsSync(UI_PRIMITIVES_DIST);
  return {
    id: "p2_ui_primitives_dist",
    description: "ui-primitives dist/Button/Button.js exists (subpath build; no barrel)",
    required: true,
    ok,
    detail: ok ? null : "missing dist — pnpm --filter @app-tour/ui-primitives build",
  };
}

/** @returns {GuardCheck} */
function checkThemeReactDist() {
  const ok = fs.existsSync(THEME_REACT_DIST);
  return {
    id: "p2_theme_react_dist",
    description: "theme-react dist/index.js exists (build in phase-2:gate)",
    required: true,
    ok,
    detail: ok ? null : "missing dist — pnpm --filter @app-tour/theme-react build",
  };
}

/** @param {string} filter @param {number} min @param {string} id @param {string} desc */
function checkPackageTests(filter, min, id, desc) {
  const r = runPnpm(["--filter", filter, "run", "test"]);
  const { ok, count, output } = evaluatePackageTestRun(r, min);
  return {
    id,
    description: `${desc} (enforced count)`,
    required: true,
    ok,
    detail: ok
      ? `${count} tests`
      : truncateDetail(
          count != null ? `${count} tests (need ≥ ${min})\n${output}` : `could not parse test count\n${output}`,
        ),
  };
}

/** @returns {GuardCheck} */
function checkVisualRegression() {
  const r = runPnpm(["--filter", "@app-tour/ui-primitives", "run", "test:visual"]);
  const { ok, count, output } = evaluatePackageTestRun(r, MIN_VISUAL_TESTS);
  return {
    id: "p2_visual_regression",
    description: `ui-primitives test:visual ≥ ${MIN_VISUAL_TESTS} (enforced count)`,
    required: true,
    ok,
    detail: ok ? `${count} visual tests` : truncateDetail(output),
  };
}

/** @returns {GuardCheck} */
function checkNoDenaliInPhase2Packages() {
  const r = rg(["-i", "denali"], PHASE2_SCAN_DIRS);
  const ok = r.lines.length === 0;
  return {
    id: "p2_no_denali",
    description: "rg -i denali phase-2 package src/ → 0",
    required: true,
    ok,
    detail: ok ? null : truncateDetail(r.lines.slice(0, 15).join("\n")),
  };
}

/** @returns {GuardCheck} */
function checkArtifactSurfaceGuard() {
  const script = path.join(REPO_ROOT, "scripts/guards/artifact-surface-guard.mjs");
  const r = spawnSync(process.execPath, [script], { cwd: REPO_ROOT, encoding: "utf8" });
  const ok = r.status === 0;
  return {
    id: "p2_artifact_surface_guard",
    description: "theme-react + ui-primitives dist matches files/exports allowlist",
    required: true,
    ok,
    detail: ok ? null : truncateDetail((r.stdout ?? "") + (r.stderr ?? "")),
  };
}

/** @returns {GuardCheck} */
function checkUiPrimitivesNoBarrelExport() {
  const pkgPath = path.join(REPO_ROOT, "packages/ui-primitives/package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  const exports = pkg.exports ?? {};
  const failures = [];

  if (Object.prototype.hasOwnProperty.call(exports, ".")) {
    failures.push('package.json exports must not include "." (barrel deprecated)');
  }
  if (pkg.main || pkg.types) {
    failures.push("package.json must not set main/types barrel fields");
  }
  const barrelDist = path.join(REPO_ROOT, "packages/ui-primitives/dist/index.js");
  if (fs.existsSync(barrelDist)) {
    failures.push("dist/index.js must not exist (barrel excluded from build)");
  }

  const auditScript = path.join(REPO_ROOT, "scripts/guards/audit-ui-primitives-boundary.mjs");
  const r = spawnSync(process.execPath, [auditScript], { cwd: REPO_ROOT, encoding: "utf8" });
  if (r.status !== 0) {
    failures.push(truncateDetail((r.stdout ?? "") + (r.stderr ?? "")) ?? "audit-ui-primitives-boundary failed");
  }

  const ok = failures.length === 0;
  return {
    id: "p2_ui_primitives_no_barrel",
    description: "ui-primitives: no barrel export; apps use subpaths only (audit-boundary)",
    required: true,
    ok,
    detail: ok ? `subpaths: ${Object.keys(exports).join(", ")}` : truncateDetail(failures.join("\n")),
  };
}

/** @returns {GuardCheck} */
function checkThemeReactExportAllowlistL01() {
  const pkgPath = path.join(REPO_ROOT, "packages/theme-react/package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  const exportKeys = Object.keys(pkg.exports ?? {});
  const allowed = new Set(["."]);
  const failures = [];

  for (const key of exportKeys) {
    if (!allowed.has(key)) {
      failures.push(`exports key not allowed: ${key}`);
    }
  }
  if (Object.prototype.hasOwnProperty.call(pkg.exports ?? {}, "./internal")) {
    failures.push("exports contains ./internal");
  }
  if (!Array.isArray(pkg.files) || pkg.files.length === 0) {
    failures.push("files array missing (L-01 publish whitelist)");
  }
  if ((pkg.files ?? []).includes("dist/harness")) {
    failures.push("files must not include dist/harness");
  }

  const verifyScript = path.join(REPO_ROOT, "packages/theme-react/scripts/verify-export-allowlist.mjs");
  const r = spawnSync(process.execPath, [verifyScript], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  if (r.status !== 0) {
    failures.push(truncateDetail((r.stdout ?? "") + (r.stderr ?? "")) ?? "verify-export-allowlist failed");
  }

  const ok = failures.length === 0;
  return {
    id: "p2_theme_react_export_allowlist_l01",
    description: "theme-react strict exports (.) + files whitelist + blocked subpaths (L-01)",
    required: true,
    ok,
    detail: ok ? `exports: ${exportKeys.join(", ")}` : truncateDetail(failures.join("\n")),
  };
}

/** @returns {GuardCheck} */
function checkThemeReactNoInternalExport() {
  const pkgPath = path.join(REPO_ROOT, "packages/theme-react/package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  const exports = pkg.exports ?? {};
  const hasInternal = Object.prototype.hasOwnProperty.call(exports, "./internal");
  const r = rg(
    ["@app-tour/theme-react/internal"],
    [
      path.join(REPO_ROOT, "packages"),
      path.join(REPO_ROOT, "apps"),
    ],
  );
  const importHits = r.lines.filter((line) => {
    if (line.includes("phase-2-guard.mjs")) return false;
    if (line.includes("verify-export-allowlist.mjs")) return false;
    if (line.includes("phase-2.contract.spec.ts")) return false;
    if (line.includes("TEMP/")) return false;
    return /from\s+["']@app-tour\/theme-react\/internal["']/.test(line);
  });
  const ok = !hasInternal && importHits.length === 0;
  return {
    id: "p2_theme_react_no_internal_export",
    description: "no @app-tour/theme-react/internal export or imports",
    required: true,
    ok,
    detail: ok
      ? null
      : truncateDetail(
          [
            hasInternal ? "package.json still exports ./internal" : null,
            importHits.length > 0 ? importHits.slice(0, 10).join("\n") : null,
          ]
            .filter(Boolean)
            .join("\n"),
        ),
  };
}

/** @returns {GuardCheck} */
function checkPhase2ContractBehaviors() {
  const r = spawnSync("pnpm", ["--filter", "@app-tour/platform-core", "run", "test:phase-2"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    shell: true,
    maxBuffer: 8 * 1024 * 1024,
  });
  const output = `${r.stdout ?? ""}\n${r.stderr ?? ""}`;
  const count = parseTestCount(output);
  const ok =
    r.status === 0 &&
    count != null &&
    count >= PHASE_2_BEHAVIOR_CONTRACT_MIN &&
    !outputHasTestFailures(output);
  return {
    id: "p2_phase2_contract_behaviors",
    description: `phase-2.contract.spec.ts ≥ ${PHASE_2_BEHAVIOR_CONTRACT_MIN} behavioral rows`,
    required: true,
    ok,
    detail: ok
      ? `${count} contract tests (${PHASE_2_CONTRACT_SPEC})`
      : truncateDetail(
          count != null
            ? `${count} tests (need ≥ ${PHASE_2_BEHAVIOR_CONTRACT_MIN})\n${output}`
            : output,
        ),
  };
}

/** @returns {GuardCheck} */
function checkPlatformCoreNoDesignTokens() {
  const r = rg(
    ["design-tokens"],
    [
      path.join(REPO_ROOT, "packages/platform-core/package.json"),
      path.join(REPO_ROOT, "packages/platform-core/src"),
    ],
  );
  const ok = r.lines.length === 0;
  return {
    id: "p2_platform_core_no_tokens",
    description: "platform-core must not depend on design-tokens",
    required: true,
    ok,
    detail: ok ? null : truncateDetail(r.lines.join("\n")),
  };
}

function main() {
  const checks = [
    checkDesignTokensDist(),
    checkValidateDesignTokens(),
    checkDesignTokensTests(),
    checkUiPrimitivesBuild(),
    checkUiPrimitivesNoBarrelExport(),
    checkArtifactSurfaceGuard(),
    checkThemeReactDist(),
    checkPackageTests(
      "@app-tour/workspace-sdk",
      MIN_WORKSPACE_SDK_TESTS,
      "p2_workspace_sdk_tests",
      `workspace-sdk tests ≥ ${MIN_WORKSPACE_SDK_TESTS}`,
    ),
    checkPackageTests(
      "@app-tour/ui-primitives",
      MIN_UI_PRIMITIVES_TESTS,
      "p2_ui_primitives_tests",
      `ui-primitives tests ≥ ${MIN_UI_PRIMITIVES_TESTS}`,
    ),
    checkPackageTests(
      "@app-tour/theme-react",
      MIN_THEME_REACT_TESTS,
      "p2_theme_react_tests",
      `theme-react tests ≥ ${MIN_THEME_REACT_TESTS} (includes theme ingress guard)`,
    ),
    checkVisualRegression(),
    checkNoDenaliInPhase2Packages(),
    checkThemeReactExportAllowlistL01(),
    checkThemeReactNoInternalExport(),
    checkPlatformCoreNoDesignTokens(),
    checkPhase2ContractBehaviors(),
  ];

  const requiredOk = checks.filter((c) => c.required).every((c) => c.ok);
  const dateSlug = new Date().toISOString().slice(0, 10);
  const baseName = `phase-2-gate-${dateSlug}`;

  const report = {
    generatedAt: new Date().toISOString(),
    gitSha: gitShortSha(),
    phase: "2.5",
    checks,
    exit: {
      pass: requiredOk,
      note: "design-tokens + ui-primitives + theme-react + theme ingress + visual tests",
    },
  };

  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const jsonPath = path.join(REPORTS_DIR, `${baseName}.json`);
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

  console.log(`phase-2-guard: wrote ${path.relative(REPO_ROOT, jsonPath)}`);
  console.log(`phase-2-guard: ${requiredOk ? "PASS" : "FAIL"}`);
  for (const c of checks) {
    console.log(`  ${c.ok ? "✓" : "✗"} ${c.id}`);
  }

  if (!requiredOk) {
    process.exit(1);
  }
}

main();
