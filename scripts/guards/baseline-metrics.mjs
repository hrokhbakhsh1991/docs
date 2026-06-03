#!/usr/bin/env node
/**
 * Phase 0.6 — app-tour baseline metrics (coupling + SDK size).
 * Usage: node scripts/guards/baseline-metrics.mjs
 * Output: reports/phase-0-baseline-YYYY-MM-DD.json + .md
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { FOUNDATION_GATE_DENALI_DIRS } from "./foundation-gate-config.mjs";
import { guardSubprocessEnv } from "./lib/guard-subprocess-env.mjs";
import { outputHasTestFailures, parseTestCount } from "./lib/parse-test-output.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const REPORTS_DIR = path.join(REPO_ROOT, "reports");
const PACKAGES_ROOT = path.join(REPO_ROOT, "packages");
const SDK_ROOT = path.join(PACKAGES_ROOT, "workspace-sdk");
const SDK_INDEX = path.join(SDK_ROOT, "src/index.ts");

const NEW_PACKAGE_LAYERS = [
  "packages/config",
  "packages/workspace-sdk",
  "packages/platform-core",
  "packages/workspaces",
];

/** Count thresholds retired (H-03/H-13) — informational metrics only. */
const THRESHOLDS = {};

function gitShortSha() {
  const r = spawnSync("git", ["rev-parse", "--short", "HEAD"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    env: guardSubprocessEnv(),
  });
  return r.status === 0 ? r.stdout.trim() : "unknown";
}

/** @returns {{ denaliOk: boolean, legacyOk: boolean }} */
function runCouplingContractTests() {
  const nodeArgs = [
    "--import",
    "tsx",
    "--test",
    "test/denali-coupling.contract.spec.ts",
    "test/legacy-import.contract.spec.ts",
  ];
  const env = guardSubprocessEnv({
    NODE_ENV: "test",
    LEGACY_IMPORT_SCAN_SCOPE: "foundation",
  });
  const denali = spawnSync(process.execPath, nodeArgs.slice(0, 4).concat("test/denali-coupling.contract.spec.ts"), {
    cwd: SDK_ROOT,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
    env,
  });
  const legacy = spawnSync(process.execPath, nodeArgs.slice(0, 4).concat("test/legacy-import.contract.spec.ts"), {
    cwd: SDK_ROOT,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
    env,
  });
  return {
    denaliOk: denali.status === 0,
    legacyOk: legacy.status === 0,
    denaliDetail: denali.status === 0 ? null : (denali.stderr ?? denali.stdout ?? "").trim().slice(-1200),
    legacyDetail: legacy.status === 0 ? null : (legacy.stderr ?? legacy.stdout ?? "").trim().slice(-1200),
  };
}

function countSdkSourceFiles() {
  const srcDir = path.join(SDK_ROOT, "src");
  if (!fs.existsSync(srcDir)) return 0;
  let n = 0;
  const walk = (dir) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (ent.isFile() && /\.ts$/.test(ent.name) && !/\.spec\.ts$/.test(ent.name)) n += 1;
    }
  };
  walk(srcDir);
  return n;
}

function countSdkExports() {
  if (!fs.existsSync(SDK_INDEX)) return 0;
  const text = fs.readFileSync(SDK_INDEX, "utf8");
  const blockExports = (text.match(/\bexport\s+\{/g) ?? []).length;
  const directExports = (text.match(/^export\s+(?!{)/gm) ?? []).length;
  return blockExports + directExports;
}

function countSdkTestsFromSource() {
  const specs = [];
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (ent.isFile() && /\.spec\.ts$/.test(ent.name)) specs.push(p);
    }
  };
  walk(path.join(SDK_ROOT, "src"));
  walk(path.join(SDK_ROOT, "test"));
  let itCount = 0;
  for (const file of specs) {
    const text = fs.readFileSync(file, "utf8");
    itCount += (text.match(/\bit\s*\(/g) ?? []).length;
  }
  return { itCount, specFileCount: specs.length };
}

/** @returns {{ ok: boolean, testCount: number | null, outputTail: string | null }} */
function runSdkTestSuite() {
  const r = spawnSync("pnpm", ["--filter", "@app-tour/workspace-sdk", "run", "test"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    shell: true,
    maxBuffer: 16 * 1024 * 1024,
    env: guardSubprocessEnv({ NODE_ENV: "test" }),
  });
  const output = `${r.stdout ?? ""}\n${r.stderr ?? ""}`;
  const testCount = parseTestCount(output);
  const ok = r.status === 0 && testCount != null && !outputHasTestFailures(output);
  return {
    ok,
    testCount,
    outputTail: ok ? null : output.trim().slice(-1200),
  };
}

function listNewPackages() {
  if (!fs.existsSync(PACKAGES_ROOT)) return [];
  return fs
    .readdirSync(PACKAGES_ROOT, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

function evaluateThresholds(metrics) {
  const checks = [
    {
      id: "t2_denali_coupling_contract",
      ok: metrics.denali_coupling_contract_ok === true,
      expected: "denali-coupling.contract.spec.ts PASS",
      actual: metrics.denali_coupling_contract_ok,
    },
    {
      id: "t3_legacy_import_contract",
      ok: metrics.legacy_import_contract_ok === true,
      expected: "legacy-import.contract.spec.ts PASS",
      actual: metrics.legacy_import_contract_ok,
    },
  ];
  return { checks, pass: checks.every((c) => c.ok) };
}

function renderMarkdown(report, jsonRel, dateSlug) {
  const m = report.metrics;
  const lines = [
    `# Phase 0 baseline — ${dateSlug}`,
    "",
    `- **Generated:** ${report.generatedAt}`,
    `- **Git SHA:** \`${report.gitSha}\``,
    `- **JSON:** [${jsonRel}](${jsonRel})`,
    "",
    "## Summary metrics",
    "",
    "| Metric | Value |",
    "|--------|-------|",
    `| workspace_sdk_test_it_source (informational) | ${m.workspace_sdk_test_it_source} |`,
    `| workspace_sdk_export_count | ${m.workspace_sdk_export_count} |`,
    `| workspace_sdk_source_files | ${m.workspace_sdk_source_files} |`,
    `| denali_coupling_contract_ok | ${m.denali_coupling_contract_ok} |`,
    `| legacy_import_contract_ok | ${m.legacy_import_contract_ok} |`,
    `| new_packages | ${m.new_packages.join(", ")} |`,
    "",
    "## Per-layer denali (foundation contract scope)",
    "",
    "| Layer | enforced | source |",
    "|-------|----------|--------|",
  ];

  for (const [layer, data] of Object.entries(report.layers)) {
    lines.push(
      `| \`${layer}\` | ${data.enforced ? "yes" : "no"} | ${data.source ?? "—"} |`,
    );
  }

  lines.push("", "## Threshold checks", "", "| ID | Expected | Actual | Result |", "|----|----------|--------|--------|");
  for (const c of report.exit06.checks) {
    lines.push(`| ${c.id} | ${c.expected} | ${c.actual} | ${c.ok ? "PASS" : "FAIL"} |`);
  }

  lines.push(
    "",
    "## Phase 0.6 exit",
    "",
    report.exit06.pass ? "- **Phase 0.6 baseline:** PASS" : "- **Phase 0.6 baseline:** FAIL",
    "",
    "> Regression: re-run `pnpm run baseline:metrics` after structural PRs; compare JSON gitSha.",
    "",
  );

  return lines.join("\n");
}

function main() {
  const testSource = countSdkTestsFromSource();
  const testRun = runSdkTestSuite();
  const coupling = runCouplingContractTests();
  const foundationDenaliSet = new Set(FOUNDATION_GATE_DENALI_DIRS);
  const layers = {};
  for (const layer of NEW_PACKAGE_LAYERS) {
    const inFoundation = foundationDenaliSet.has(layer);
    layers[layer] = {
      enforced: inFoundation,
      source: inFoundation ? "denali-coupling.contract.spec.ts" : "outside foundation scan",
    };
  }

  const metrics = {
    workspace_sdk_test_count: testRun.testCount ?? testSource.itCount,
    workspace_sdk_test_it_source: testSource.itCount,
    workspace_sdk_spec_files: testSource.specFileCount,
    workspace_sdk_export_count: countSdkExports(),
    workspace_sdk_source_files: countSdkSourceFiles(),
    denali_coupling_contract_ok: coupling.denaliOk,
    legacy_import_contract_ok: coupling.legacyOk,
    new_packages: listNewPackages(),
    platform_core_exists: fs.existsSync(path.join(PACKAGES_ROOT, "platform-core")),
    apps_exists: fs.existsSync(path.join(REPO_ROOT, "apps")),
  };

  const { checks, pass } = evaluateThresholds(metrics);

  const report = {
    generatedAt: new Date().toISOString(),
    gitSha: gitShortSha(),
    phase: "0.6",
    thresholds: THRESHOLDS,
    metrics,
    layers,
    couplingContracts: coupling,
    testRun: {
      ok: testRun.ok,
      testCount: testRun.testCount,
    },
    exit06: {
      pass: pass && testRun.ok && coupling.denaliOk && coupling.legacyOk,
      checks,
      note: "coupling contract tests (denali + legacy depcruise) + SDK test floor",
    },
  };

  if (!testRun.ok) {
    report.exit06.pass = false;
    report.testRunFailure = testRun.outputTail;
  }
  if (!coupling.denaliOk) {
    report.exit06.pass = false;
    report.denaliContractFailure = coupling.denaliDetail;
  }
  if (!coupling.legacyOk) {
    report.exit06.pass = false;
    report.legacyContractFailure = coupling.legacyDetail;
  }

  const dateSlug = new Date().toISOString().slice(0, 10);
  const baseName = `phase-0-baseline-${dateSlug}`;
  fs.mkdirSync(REPORTS_DIR, { recursive: true });

  const jsonPath = path.join(REPORTS_DIR, `${baseName}.json`);
  const mdPath = path.join(REPORTS_DIR, `${baseName}.md`);
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(mdPath, renderMarkdown(report, `reports/${baseName}.json`, dateSlug));

  console.log(`baseline-metrics: wrote ${path.relative(REPO_ROOT, jsonPath)}`);
  console.log(`baseline-metrics: ${report.exit06.pass ? "PASS" : "FAIL"}`);
  console.log(`  spec it-blocks (informational): ${metrics.workspace_sdk_test_it_source}`);
  console.log(`  denali coupling contract: ${metrics.denali_coupling_contract_ok ? "PASS" : "FAIL"}`);
  console.log(`  legacy import contract: ${metrics.legacy_import_contract_ok ? "PASS" : "FAIL"}`);
  console.log(`  sdk exports: ${metrics.workspace_sdk_export_count}`);

  for (const c of checks) {
    console.log(`  ${c.ok ? "✓" : "✗"} ${c.id} (${c.actual} vs ${c.expected})`);
  }

  if (!report.exit06.pass) process.exit(1);
}

main();
