#!/usr/bin/env node
/**
 * Phase 1.6 — platform-core gate (build artifact, tests, denali-free, depcruise).
 * Usage: node scripts/guards/phase-1-guard.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const REPORTS_DIR = path.join(REPO_ROOT, "reports");
const PLATFORM_CORE_DIST = path.join(
  REPO_ROOT,
  "packages/platform-core/dist/index.js",
);
const PLATFORM_CORE_ROOT = path.join(REPO_ROOT, "packages/platform-core");
const WORKSPACE_SDK_ROOT = path.join(REPO_ROOT, "packages/workspace-sdk");
const MIN_PLATFORM_CORE_TESTS = 94;
const MIN_WORKSPACE_SDK_TESTS = 39;
const ADVERSARIAL_SPEC_PATHS = [
  "packages/workspace-sdk/test/adversarial-canonical-ingress.spec.ts",
  "packages/workspace-sdk/test/storage-ingress-immutability.spec.ts",
  "packages/platform-core/test/adversarial-validation.spec.ts",
  "packages/platform-core/test/rule-engine-concurrency.spec.ts",
  "packages/platform-core/test/runtime-isolation.spec.ts",
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

/** Node test runner reports `# tests N` (TAP) or `ℹ tests N` (spec reporter). */
function parseTestCount(output) {
  const matches = [...String(output).matchAll(/[#ℹ] tests (\d+)/g)];
  if (matches.length === 0) {
    return null;
  }
  return Number.parseInt(matches[matches.length - 1][1], 10);
}

function outputHasTestFailures(output) {
  return [...String(output).matchAll(/[#ℹ] fail (\d+)/g)].some((m) => Number.parseInt(m[1], 10) > 0);
}

/** @returns {GuardCheck} */
function checkPlatformCoreDistExists() {
  const ok = fs.existsSync(PLATFORM_CORE_DIST);
  return {
    id: "g1_platform_core_dist",
    description: "packages/platform-core/dist/index.js exists (run pnpm build first)",
    required: true,
    ok,
    detail: ok ? PLATFORM_CORE_DIST : "missing — pnpm build",
  };
}

/** @returns {GuardCheck} */
function checkWorkspaceSdkTestCount() {
  const r = spawnSync("pnpm", ["--filter", "@app-tour/workspace-sdk", "run", "test"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    shell: true,
    maxBuffer: 8 * 1024 * 1024,
  });
  const output = `${r.stdout ?? ""}\n${r.stderr ?? ""}`;
  const count = parseTestCount(output);
  const ok = r.status === 0 && count != null && count >= MIN_WORKSPACE_SDK_TESTS;
  return {
    id: "g2b_workspace_sdk_test_count",
    description: `workspace-sdk tests ≥ ${MIN_WORKSPACE_SDK_TESTS}`,
    required: true,
    ok,
    detail: ok
      ? `${count} tests`
      : truncateDetail(
          count != null
            ? `${count} tests (need ≥ ${MIN_WORKSPACE_SDK_TESTS})\n${output}`
            : output,
        ),
  };
}

/** @returns {GuardCheck} */
function checkAdversarialSpecFilesTracked() {
  const missing = ADVERSARIAL_SPEC_PATHS.filter((rel) => !fs.existsSync(path.join(REPO_ROOT, rel)));
  const ok = missing.length === 0;
  return {
    id: "g9_adversarial_spec_files",
    description: "adversarial test/**/*.spec.ts entry files exist on disk",
    required: true,
    ok,
    detail: ok ? null : `missing: ${missing.join(", ")}`,
  };
}

/** @returns {GuardCheck} */
function checkAdversarialSpecsExecute() {
  const r = spawnSync("pnpm", ["run", "test:adversarial"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    shell: true,
    env: { ...process.env, NODE_ENV: "test" },
    maxBuffer: 8 * 1024 * 1024,
  });
  const output = `${r.stdout ?? ""}\n${r.stderr ?? ""}`;
  const ok = r.status === 0 && !outputHasTestFailures(output);
  return {
    id: "g10_adversarial_specs_execute",
    description: "pnpm run test:adversarial — adversarial entry specs pass",
    required: true,
    ok,
    detail: ok ? "adversarial specs green" : truncateDetail(output),
  };
}

/** @returns {GuardCheck} */
function checkPlatformCoreTestCount() {
  const r = spawnSync("pnpm", ["--filter", "@app-tour/platform-core", "run", "test"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    shell: true,
    maxBuffer: 8 * 1024 * 1024,
  });
  const output = `${r.stdout ?? ""}\n${r.stderr ?? ""}`;
  const count = parseTestCount(output);
  const ok = r.status === 0 && count != null && count >= MIN_PLATFORM_CORE_TESTS;
  return {
    id: "g2_platform_core_test_count",
    description: `platform-core tests ≥ ${MIN_PLATFORM_CORE_TESTS}`,
    required: true,
    ok,
    detail: ok
      ? `${count} tests`
      : truncateDetail(
          count != null
            ? `${count} tests (need ≥ ${MIN_PLATFORM_CORE_TESTS})\n${output}`
            : output,
        ),
  };
}

/** @returns {GuardCheck} */
function checkNoDenaliInPlatformCore() {
  const r = rg(["-i", "denali", "-g", "!**/*.spec.ts"], PLATFORM_CORE_ROOT);
  const ok = r.lines.length === 0;
  return {
    id: "g3_no_denali_tokens",
    description: "rg -i denali packages/platform-core (excl. *.spec.ts) → 0",
    required: true,
    ok,
    detail: ok ? null : truncateDetail(r.lines.slice(0, 15).join("\n")),
  };
}

/** @returns {GuardCheck} */
function checkNoReactInPlatformCore() {
  const r = rg(["react", "react-dom", "from \"react\""], PLATFORM_CORE_ROOT);
  const ok = r.lines.length === 0;
  return {
    id: "g4_no_react_imports",
    description: "no react/react-dom imports in platform-core",
    required: true,
    ok,
    detail: ok ? null : truncateDetail(r.lines.join("\n")),
  };
}

/** @returns {GuardCheck} */
function checkResolutionNegativeTests() {
  const r = spawnSync(
    "pnpm",
    [
      "--filter",
      "@app-tour/platform-core",
      "exec",
      "node",
      "--import",
      "tsx",
      "--test",
      "src/engine/rule.engine.spec.ts",
    ],
    {
      cwd: REPO_ROOT,
      encoding: "utf8",
      shell: true,
      env: { ...process.env, NODE_ENV: "test" },
      maxBuffer: 8 * 1024 * 1024,
    },
  );
  const output = `${r.stdout ?? ""}\n${r.stderr ?? ""}`;
  const ok =
    r.status === 0 &&
    output.includes("prefers specificity over priority") &&
    output.includes("prefers specific dimension match over catch-all") &&
    output.includes("prefers more matched context keys");
  return {
    id: "g7_resolution_negative_tests",
    description: "rule.engine.spec specificity matrix tests execute and pass",
    required: true,
    ok,
    detail: ok ? null : truncateDetail(output),
  };
}

/** @returns {GuardCheck} */
function checkSymlinkGuard() {
  const r = spawnSync("pnpm", ["run", "guard:symlink"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    shell: true,
    maxBuffer: 8 * 1024 * 1024,
  });
  const ok = r.status === 0;
  return {
    id: "g8_symlink_guard",
    description: "pnpm run guard:symlink",
    required: true,
    ok,
    detail: ok ? null : truncateDetail((r.stdout ?? r.stderr ?? "").trim()) || `exit ${r.status}`,
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
    id: "g6_import_boundary",
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
    id: "g5_depcruise_architecture",
    description: "pnpm run guard:architecture",
    required: true,
    ok,
    detail: ok ? null : truncateDetail((r.stdout ?? r.stderr ?? "").trim()) || `exit ${r.status}`,
  };
}

function renderMarkdown(report, jsonRel, dateSlug) {
  const lines = [
    `# Phase 1 gate — ${dateSlug}`,
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

  lines.push("", "## Phase 1 exit", "");
  lines.push(
    report.exit16.pass
      ? "- **Phase 1 gate:** PASS"
      : "- **Phase 1 gate:** FAIL",
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
    checkPlatformCoreDistExists(),
    checkWorkspaceSdkTestCount(),
    checkPlatformCoreTestCount(),
    checkAdversarialSpecFilesTracked(),
    checkAdversarialSpecsExecute(),
    checkNoDenaliInPlatformCore(),
    checkNoReactInPlatformCore(),
    checkArchitectureGuard(),
    checkImportBoundaryGuard(),
    checkResolutionNegativeTests(),
    checkSymlinkGuard(),
  ];

  const requiredOk = checks.filter((c) => c.required).every((c) => c.ok);

  const report = {
    generatedAt: new Date().toISOString(),
    gitSha: gitShortSha(),
    phase: "1.6",
    checks,
    exit16: {
      pass: requiredOk,
      note: "platform-core: dist + ≥94 tests + workspace-sdk ≥39 (133 total) + adversarial + denali-free + no react + depcruise",
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
