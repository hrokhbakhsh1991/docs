#!/usr/bin/env node
/**
 * Phase 0.5 — CI gate checks for app-tour foundation.
 * Usage: node scripts/guards/phase-0-guard.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const REPORTS_DIR = path.join(REPO_ROOT, "reports");
const SDK_DIST = path.join(REPO_ROOT, "packages/workspace-sdk/dist/index.js");
const PACKAGE_SCAN_DIRS = [
  path.join(REPO_ROOT, "packages/workspace-sdk"),
  path.join(REPO_ROOT, "packages/config"),
  path.join(REPO_ROOT, "packages/platform-core"),
];
const DETAIL_MAX = 2000;

/** @typedef {{ id: string, description: string, required: boolean, ok: boolean, detail?: string | null }} GuardCheck */

function gitShortSha() {
  const r = spawnSync("git", ["rev-parse", "--short", "HEAD"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  return r.status === 0 ? r.stdout.trim() : "unknown";
}

function rg(args, searchPaths) {
  const paths = (Array.isArray(searchPaths) ? searchPaths : [searchPaths]).filter((p) =>
    fs.existsSync(p),
  );
  if (paths.length === 0) {
    return { exitCode: 0, lines: [], stderr: null };
  }
  const r = spawnSync("rg", [...args, ...paths], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  const lines = (r.stdout ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return { exitCode: r.status ?? 1, lines, stderr: r.stderr?.trim() || null };
}

function truncateDetail(text) {
  if (text == null) return null;
  const t = String(text).trim();
  if (t.length <= DETAIL_MAX) return t;
  return `${t.slice(0, DETAIL_MAX)}\n… (truncated)`;
}

/** @returns {GuardCheck} */
function checkSdkDistExists() {
  const ok = fs.existsSync(SDK_DIST);
  return {
    id: "g1_sdk_dist_exists",
    description: "packages/workspace-sdk/dist/index.js exists (run pnpm build first)",
    required: true,
    ok,
    detail: ok ? SDK_DIST : "missing — pnpm build",
  };
}

/** @returns {GuardCheck} */
function checkNoDenaliInNewPackages() {
  const r = rg(["-i", "denali", "-g", "!**/*.spec.ts"], PACKAGE_SCAN_DIRS);
  const ok = r.lines.length === 0;
  return {
    id: "g2_no_denali_tokens",
    description:
      "rg -i denali packages/workspace-sdk packages/config packages/platform-core (excl. *.spec.ts) → 0",
    required: true,
    ok,
    detail: ok ? null : truncateDetail(r.lines.slice(0, 15).join("\n")),
  };
}

/** @returns {GuardCheck} */
function checkNoLegacyImportsInPackages() {
  const packagesDir = path.join(REPO_ROOT, "packages");
  const r = rg(["legacy/", "from \"../legacy", "from '../legacy"], [packagesDir]);
  const ok = r.lines.length === 0;
  return {
    id: "g3_no_legacy_imports",
    description: "no legacy/ imports under packages/",
    required: true,
    ok,
    detail: ok ? null : truncateDetail(r.lines.join("\n")),
  };
}

/** @returns {GuardCheck} */
function checkImportBoundaryGuard() {
  const r = spawnSync("pnpm", ["run", "guard:import-boundary"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    shell: true,
    maxBuffer: 8 * 1024 * 1024,
  });
  const ok = r.status === 0;
  return {
    id: "g4b_import_boundary",
    description: "pnpm run guard:import-boundary",
    required: true,
    ok,
    detail: ok ? null : truncateDetail((r.stdout ?? r.stderr ?? "").trim()) || `exit ${r.status}`,
  };
}

/** @returns {GuardCheck} */
function checkArchitectureGuard() {
  const r = spawnSync("pnpm", ["run", "guard:architecture"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    shell: true,
    maxBuffer: 8 * 1024 * 1024,
  });
  const ok = r.status === 0;
  return {
    id: "g4_depcruise_architecture",
    description: "pnpm run guard:architecture",
    required: true,
    ok,
    detail: ok ? null : truncateDetail((r.stdout ?? r.stderr ?? "").trim()) || `exit ${r.status}`,
  };
}

/** @returns {GuardCheck} */
function checkWorkspaceSdkTests() {
  const start = Date.now();
  const r = spawnSync("pnpm", ["--filter", "@app-tour/workspace-sdk", "run", "test"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    shell: true,
    maxBuffer: 8 * 1024 * 1024,
  });
  const ok = r.status === 0;
  return {
    id: "g5_workspace_sdk_test",
    description: "pnpm --filter @app-tour/workspace-sdk test (≥ 7 cases)",
    required: true,
    ok,
    detail: ok
      ? `${((Date.now() - start) / 1000).toFixed(1)}s`
      : truncateDetail((r.stderr ?? r.stdout ?? "").trim()) || `exit ${r.status}`,
  };
}

function renderMarkdown(report, jsonRel, dateSlug) {
  const lines = [
    `# Phase 0 gate — ${dateSlug}`,
    "",
    `- **Generated:** ${report.generatedAt}`,
    `- **Git SHA:** \`${report.gitSha}\``,
    `- **JSON:** [${jsonRel}](${jsonRel})`,
    "",
    "## Checks",
    "",
    "| ID | Required | Result |",
    "|----|----------|--------|",
  ];

  for (const c of report.checks) {
    lines.push(`| ${c.id} | ${c.required ? "yes" : "no"} | ${c.ok ? "PASS" : "FAIL"} |`);
  }

  lines.push("", "## Phase 0.5 exit", "");
  lines.push(
    report.exit05.pass
      ? "- **Phase 0.5 gate:** PASS"
      : "- **Phase 0.5 gate:** FAIL",
  );

  const failed = report.checks.filter((c) => !c.ok);
  if (failed.length) {
    lines.push("", "## Failure details", "");
    for (const c of failed) {
      lines.push(`### ${c.id}`, "", c.detail ?? "(no detail)", "");
    }
  }

  return `${lines.join("\n")}\n`;
}

function main() {
  const checks = [
    checkSdkDistExists(),
    checkNoDenaliInNewPackages(),
    checkNoLegacyImportsInPackages(),
    checkArchitectureGuard(),
    checkImportBoundaryGuard(),
    checkWorkspaceSdkTests(),
  ];

  const requiredOk = checks.filter((c) => c.required).every((c) => c.ok);

  const report = {
    generatedAt: new Date().toISOString(),
    gitSha: gitShortSha(),
    phase: "0.5",
    checks,
    exit05: {
      pass: requiredOk,
      note: "foundation gate: dist + denali-free + no legacy imports + depcruise + sdk tests",
    },
  };

  const dateSlug = new Date().toISOString().slice(0, 10);
  const baseName = `phase-0-gate-${dateSlug}`;
  fs.mkdirSync(REPORTS_DIR, { recursive: true });

  const jsonPath = path.join(REPORTS_DIR, `${baseName}.json`);
  const mdPath = path.join(REPORTS_DIR, `${baseName}.md`);
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(mdPath, renderMarkdown(report, `reports/${baseName}.json`, dateSlug));

  console.log(`phase-0-guard: wrote ${path.relative(REPO_ROOT, jsonPath)}`);
  console.log(`phase-0-guard: ${requiredOk ? "PASS" : "FAIL"}`);

  for (const c of checks) {
    console.log(`  ${c.ok ? "✓" : "✗"} ${c.id}`);
  }

  if (!requiredOk) process.exit(1);
}

main();
