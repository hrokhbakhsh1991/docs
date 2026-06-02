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

const THRESHOLDS = {
  workspace_sdk_test_count_min: 13,
  denali_token_new_packages_max: 0,
  legacy_import_edges_max: 0,
};

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
  if (paths.length === 0) return [];
  const r = spawnSync("rg", [...args, ...paths], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  if (r.status !== 0 && r.status !== 1) return [];
  return (r.stdout ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function countDenaliTokens(layerRel) {
  const abs = path.join(REPO_ROOT, layerRel);
  if (!fs.existsSync(abs)) return { count: null, missing: true };
  const lines = rg(["-i", "denali", "-g", "!**/*.spec.ts"], abs);
  return { count: lines.length, missing: false };
}

function countLegacyImportEdges() {
  return rg(["legacy/", "from \"../legacy", "from '../legacy"], PACKAGES_ROOT).length;
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
  let itCount = 0;
  for (const file of specs) {
    const text = fs.readFileSync(file, "utf8");
    itCount += (text.match(/\bit\s*\(/g) ?? []).length;
  }
  return { itCount, specFileCount: specs.length };
}

function runSdkTests() {
  const r = spawnSync("pnpm", ["--filter", "@app-tour/workspace-sdk", "run", "test"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    shell: true,
    maxBuffer: 8 * 1024 * 1024,
  });
  const out = `${r.stdout ?? ""}\n${r.stderr ?? ""}`;
  const match = out.match(/# tests (\d+)/);
  return {
    ok: r.status === 0,
    testCount: match ? Number.parseInt(match[1], 10) : null,
    outputTail: out.trim().slice(-800),
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
      id: "t1_sdk_test_count",
      ok: metrics.workspace_sdk_test_count >= THRESHOLDS.workspace_sdk_test_count_min,
      expected: `>= ${THRESHOLDS.workspace_sdk_test_count_min}`,
      actual: metrics.workspace_sdk_test_count,
    },
    {
      id: "t2_denali_tokens",
      ok: metrics.denali_token_new_packages <= THRESHOLDS.denali_token_new_packages_max,
      expected: `<= ${THRESHOLDS.denali_token_new_packages_max}`,
      actual: metrics.denali_token_new_packages,
    },
    {
      id: "t3_legacy_imports",
      ok: metrics.legacy_import_edges <= THRESHOLDS.legacy_import_edges_max,
      expected: `<= ${THRESHOLDS.legacy_import_edges_max}`,
      actual: metrics.legacy_import_edges,
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
    `| workspace_sdk_test_count | ${m.workspace_sdk_test_count} |`,
    `| workspace_sdk_test_it_source | ${m.workspace_sdk_test_it_source} |`,
    `| workspace_sdk_export_count | ${m.workspace_sdk_export_count} |`,
    `| workspace_sdk_source_files | ${m.workspace_sdk_source_files} |`,
    `| denali_token_new_packages | ${m.denali_token_new_packages} |`,
    `| legacy_import_edges | ${m.legacy_import_edges} |`,
    `| new_packages | ${m.new_packages.join(", ")} |`,
    "",
    "## Per-layer denali tokens (new packages only)",
    "",
    "| Layer | count | missing |",
    "|-------|-------|---------|",
  ];

  for (const [layer, data] of Object.entries(report.layers)) {
    lines.push(`| \`${layer}\` | ${data.denali_token_count ?? "—"} | ${data.missing} |`);
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
  const testRun = runSdkTests();
  const testSource = countSdkTestsFromSource();

  const layers = {};
  let denaliTotal = 0;
  for (const layer of NEW_PACKAGE_LAYERS) {
    const { count, missing } = countDenaliTokens(layer);
    layers[layer] = { denali_token_count: count, missing };
    if (!missing && count != null) denaliTotal += count;
  }

  const metrics = {
    workspace_sdk_test_count: testRun.testCount ?? testSource.itCount,
    workspace_sdk_test_it_source: testSource.itCount,
    workspace_sdk_spec_files: testSource.specFileCount,
    workspace_sdk_export_count: countSdkExports(),
    workspace_sdk_source_files: countSdkSourceFiles(),
    denali_token_new_packages: denaliTotal,
    legacy_import_edges: countLegacyImportEdges(),
    new_packages: listNewPackages(),
    platform_core_exists: fs.existsSync(path.join(PACKAGES_ROOT, "platform-core")),
    apps_exists: fs.existsSync(path.join(REPO_ROOT, "apps")),
  };

  const { checks, pass } = evaluateThresholds(metrics);

  const report = {
    generatedAt: new Date().toISOString(),
    gitSha: gitShortSha(),
    phase: "0.6",
    tool: { ripgrep: spawnSync("rg", ["--version"], { encoding: "utf8" }).status === 0 },
    thresholds: THRESHOLDS,
    metrics,
    layers,
    testRun: {
      ok: testRun.ok,
      testCount: testRun.testCount,
    },
    exit06: {
      pass: pass && testRun.ok,
      checks,
      note: "zero coupling in new packages + SDK test floor",
    },
  };

  if (!testRun.ok) {
    report.exit06.pass = false;
    report.testRunFailure = testRun.outputTail;
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
  console.log(`  tests: ${metrics.workspace_sdk_test_count}`);
  console.log(`  denali tokens (new packages): ${metrics.denali_token_new_packages}`);
  console.log(`  legacy import edges: ${metrics.legacy_import_edges}`);
  console.log(`  sdk exports: ${metrics.workspace_sdk_export_count}`);

  for (const c of checks) {
    console.log(`  ${c.ok ? "✓" : "✗"} ${c.id} (${c.actual} vs ${c.expected})`);
  }

  if (!report.exit06.pass) process.exit(1);
}

main();
