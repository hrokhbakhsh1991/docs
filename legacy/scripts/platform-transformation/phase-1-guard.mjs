#!/usr/bin/env node
/**
 * Phase 1.4 — Guard @repo/workspace-sdk stays denali-free; run SDK tests.
 * Usage: node scripts/platform-transformation/phase-1-guard.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const SDK_DIR = path.join(REPO_ROOT, "packages/workspace-sdk");
const SDK_SRC = path.join(SDK_DIR, "src");
const SDK_SCAN_PATHS = [
  SDK_SRC,
  path.join(SDK_DIR, "package.json"),
  path.join(SDK_DIR, "tsconfig.json"),
];
const REPORTS_DIR = path.join(REPO_ROOT, "reports");
const DETAIL_MAX = 2000;

/** @typedef {{ id: string, description: string, required: boolean, ok: boolean, detail?: string }} GuardCheck */

function gitShortSha() {
  const r = spawnSync("git", ["rev-parse", "--short", "HEAD"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  return r.status === 0 ? r.stdout.trim() : "unknown";
}

function rg(args, searchPaths) {
  const paths = Array.isArray(searchPaths) ? searchPaths : [searchPaths];
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
function checkNoDenaliTokens() {
  const r = rg(["-i", "denali"], SDK_SRC);
  const ok = r.lines.length === 0;
  return {
    id: "g1_no_denali_tokens",
    description: "rg -i denali packages/workspace-sdk/src → 0",
    required: true,
    ok,
    detail: ok ? null : truncateDetail(r.lines.slice(0, 10).join("\n")),
  };
}

/** @returns {GuardCheck} */
function checkNoDenaliDomainImport() {
  const r = rg(["@repo/denali-domain"], SDK_SCAN_PATHS);
  const ok = r.lines.length === 0;
  return {
    id: "g2_no_denali_domain_import",
    description: "no @repo/denali-domain in workspace-sdk",
    required: true,
    ok,
    detail: ok ? null : r.lines.join("\n"),
  };
}

/** @returns {GuardCheck} */
function checkNoTypesDenaliImport() {
  const r = rg(["@repo/types/denali"], SDK_SCAN_PATHS);
  const ok = r.lines.length === 0;
  return {
    id: "g3_no_types_denali_import",
    description: "no @repo/types/denali in workspace-sdk",
    required: true,
    ok,
    detail: ok ? null : r.lines.join("\n"),
  };
}

/** @returns {GuardCheck} */
function checkSdkTests() {
  const start = Date.now();
  const r = spawnSync("pnpm", ["--filter", "@repo/workspace-sdk", "run", "test"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    shell: true,
    maxBuffer: 8 * 1024 * 1024,
  });
  const ok = r.status === 0;
  return {
    id: "g5_workspace_sdk_test",
    description: "pnpm --filter @repo/workspace-sdk test",
    required: true,
    ok,
    detail: ok
      ? `${((Date.now() - start) / 1000).toFixed(1)}s`
      : truncateDetail((r.stderr ?? r.stdout ?? "").trim()) || `exit ${r.status}`,
  };
}

/** @returns {GuardCheck} */
function checkSdkBuild() {
  const r = spawnSync("pnpm", ["--filter", "@repo/workspace-sdk", "run", "build"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    shell: true,
    maxBuffer: 8 * 1024 * 1024,
  });
  const ok = r.status === 0;
  return {
    id: "g5b_workspace_sdk_build",
    description: "pnpm --filter @repo/workspace-sdk build",
    required: true,
    ok,
    detail: ok ? null : (r.stderr ?? r.stdout ?? "").trim().slice(-1500) || `exit ${r.status}`,
  };
}

/** @returns {GuardCheck} */
function checkDepcruiseWorkspaceSdkRule() {
  const r = spawnSync(
    "pnpm",
    ["exec", "depcruise", "--config", "dependency-cruiser.config.js", "packages/workspace-sdk", "--output-type", "err"],
    {
      cwd: REPO_ROOT,
      encoding: "utf8",
      shell: true,
      maxBuffer: 8 * 1024 * 1024,
    },
  );
  const ok = r.status === 0;
  return {
    id: "g4_depcruise_workspace_sdk",
    description: "depcruise packages/workspace-sdk (incl. workspace-sdk-denali-free rule)",
    required: true,
    ok,
    detail: ok ? null : (r.stdout ?? r.stderr ?? "").trim().slice(-2000) || `exit ${r.status}`,
  };
}

function renderMarkdown(report, jsonRel, dateSlug) {
  const lines = [
    `# Phase 1 guard — ${dateSlug}`,
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

  lines.push("", "## Phase 1.4 exit", "");
  lines.push(
    report.exit14.pass
      ? "- **Phase 1.4 guards:** PASS"
      : "- **Phase 1.4 guards:** FAIL",
  );

  const failed = report.checks.filter((c) => !c.ok);
  if (failed.length) {
    lines.push("", "## Failure details", "");
    for (const c of failed) {
      lines.push(`### ${c.id}`, "", c.detail ?? "(no detail)", "");
    }
  }

  return lines.join("\n") + "\n";
}

function main() {
  if (!fs.existsSync(SDK_DIR)) {
    console.error("phase-1-guard: missing packages/workspace-sdk");
    process.exit(1);
  }

  const checks = [
    checkNoDenaliTokens(),
    checkNoDenaliDomainImport(),
    checkNoTypesDenaliImport(),
    checkSdkBuild(),
    checkSdkTests(),
    checkDepcruiseWorkspaceSdkRule(),
  ];

  const requiredOk = checks.filter((c) => c.required).every((c) => c.ok);

  const report = {
    generatedAt: new Date().toISOString(),
    gitSha: gitShortSha(),
    phase: "1.4",
    checks,
    exit14: {
      pass: requiredOk,
      note: "workspace-sdk denali-free + build + test + depcruise",
    },
  };

  const dateSlug = new Date().toISOString().slice(0, 10);
  const baseName = `phase-1-guard-${dateSlug}`;
  fs.mkdirSync(REPORTS_DIR, { recursive: true });

  const jsonPath = path.join(REPORTS_DIR, `${baseName}.json`);
  const mdPath = path.join(REPORTS_DIR, `${baseName}.md`);
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(mdPath, renderMarkdown(report, `reports/${baseName}.json`, dateSlug));

  console.log(`phase-1-guard: wrote ${path.relative(REPO_ROOT, jsonPath)}`);
  console.log(`phase-1-guard: ${requiredOk ? "PASS" : "FAIL"}`);

  for (const c of checks) {
    console.log(`  ${c.ok ? "✓" : "✗"} ${c.id}`);
  }

  if (!requiredOk) process.exit(1);
}

main();
