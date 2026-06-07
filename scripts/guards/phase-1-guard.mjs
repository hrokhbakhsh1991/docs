#!/usr/bin/env node
/**
 * Phase 1.6 — platform-core gate (build artifact, tests, denali-free, depcruise).
 * Usage: node scripts/guards/phase-1-guard.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  PHASE_1_FACADE_TEST_RATIO_MIN,
  PLATFORM_CORE_CLOSURE_TEST_MIN,
  PLATFORM_CORE_TEST_MIN,
  WORKSPACE_SDK_TEST_MIN,
} from "./gate-thresholds.mjs";
import { measureFacadeTestRatio } from "./lib/facade-test-ratio.mjs";
import {
  evaluatePackageTestRun,
  outputHasTestFailures,
  parseTestCount,
  parseTestCountSum,
} from "./lib/parse-test-output.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const REPORTS_DIR = path.join(REPO_ROOT, "reports");
const PLATFORM_CORE_DIST = path.join(
  REPO_ROOT,
  "packages/platform-core/dist/index.js",
);
const PLATFORM_CORE_ROOT = path.join(REPO_ROOT, "packages/platform-core");
const MIN_PLATFORM_CORE_TESTS = PLATFORM_CORE_TEST_MIN.phase1;
const MIN_PLATFORM_CORE_CLOSURE_TESTS = PLATFORM_CORE_CLOSURE_TEST_MIN.phase1;
const MIN_WORKSPACE_SDK_TESTS = WORKSPACE_SDK_TEST_MIN.phase1;
const ADVERSARIAL_SPEC_PATHS = [
  "packages/workspace-sdk/test/adversarial-canonical-ingress.spec.ts",
  "packages/workspace-sdk/test/storage-ingress-immutability.spec.ts",
  "packages/platform-core/test/adversarial-validation.spec.ts",
  "packages/platform-core/test/adversarial-plugin-ingress.spec.ts",
  "packages/platform-core/test/rule-engine-concurrency.spec.ts",
  "packages/platform-core/test/runtime-isolation.spec.ts",
];

const PHASE_1_CONTRACT_SPEC = "packages/platform-core/test/phase-1.contract.spec.ts";
const FACADE_INTEGRATION_SPEC = "packages/platform-core/test/facade-integration.spec.ts";
/** Path relative to @app-tour/platform-core package root for `pnpm exec --test`. */
const FACADE_INTEGRATION_TEST_ARG = "test/facade-integration.spec.ts";
const MIN_PHASE_1_BEHAVIOR_TESTS = 14;
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
  const count = parseTestCountSum(output);
  const ok =
    r.status === 0 &&
    count != null &&
    count >= MIN_PLATFORM_CORE_TESTS &&
    !outputHasTestFailures(output);
  return {
    id: "g2_platform_core_test_count",
    description: `platform-core tests ≥ ${MIN_PLATFORM_CORE_TESTS} (closure + unit:internal)`,
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
function checkPlatformCoreClosureTestCount() {
  const r = spawnSync("pnpm", ["--filter", "@app-tour/platform-core", "run", "test:closure"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    shell: true,
    maxBuffer: 8 * 1024 * 1024,
  });
  const { ok, count, output } = evaluatePackageTestRun(r, MIN_PLATFORM_CORE_CLOSURE_TESTS);
  return {
    id: "g2c_platform_core_closure_test_count",
    description: `platform-core closure tests ≥ ${MIN_PLATFORM_CORE_CLOSURE_TESTS} (excludes test/unit/**)`,
    required: true,
    ok,
    detail: ok
      ? `${count} closure tests`
      : truncateDetail(
          count != null
            ? `${count} closure tests (need ≥ ${MIN_PLATFORM_CORE_CLOSURE_TESTS})\n${output}`
            : output,
        ),
  };
}

/** @returns {GuardCheck} */
function checkPlatformCoreUnitInternalTests() {
  const r = spawnSync("pnpm", ["--filter", "@app-tour/platform-core", "run", "test:unit:internal"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    shell: true,
    maxBuffer: 8 * 1024 * 1024,
  });
  const output = `${r.stdout ?? ""}\n${r.stderr ?? ""}`;
  const count = parseTestCount(output);
  const ok = r.status === 0 && count != null && !outputHasTestFailures(output);
  return {
    id: "g2d_unit_internal_tests",
    description: "test:unit:internal passes (non-gating package policy)",
    required: true,
    ok,
    detail: ok ? `${count} unit tests` : truncateDetail(output),
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

/** Denali in `it()` / `describe()` titles is smoke labeling only — not workspace coupling. */
function lineContentFromRgMatch(rgLine) {
  const m = rgLine.match(/\.(?:spec\.)?ts:(?:(\d+):)?(.*)$/);
  return m ? m[2].trim() : rgLine.trim();
}

function isDenaliOnlyInTestTitle(rgLine) {
  const lineContent = lineContentFromRgMatch(rgLine);
  return /^(it|describe)\s*\(/.test(lineContent);
}

/** @returns {GuardCheck} */
function checkNoDenaliInPlatformCoreTests() {
  const testRoot = path.join(PLATFORM_CORE_ROOT, "test");
  if (!fs.existsSync(testRoot)) {
    return {
      id: "g3b_denali_in_platform_core_test",
      description:
        "rg -i denali packages/platform-core/test → 0 (excl. it/describe titles)",
      required: true,
      ok: true,
      detail: "no test/ directory",
    };
  }
  const r = rg(["-i", "denali"], testRoot);
  const violations = r.lines.filter((line) => !isDenaliOnlyInTestTitle(line));
  const ok = violations.length === 0;
  return {
    id: "g3b_denali_in_platform_core_test",
    description:
      "rg -i denali packages/platform-core/test → 0 (excl. it/describe titles)",
    required: true,
    ok,
    detail: ok ? null : truncateDetail(violations.slice(0, 15).join("\n")),
  };
}

/** @returns {GuardCheck} */
function checkNoDenaliInPlatformCoreDist() {
  if (!fs.existsSync(PLATFORM_CORE_DIST)) {
    return {
      id: "g3c_denali_in_platform_core_dist",
      description: "rg -i denali packages/platform-core/dist → 0 (after build)",
      required: true,
      ok: false,
      detail: "dist missing — run pnpm build",
    };
  }
  const distRoot = path.join(PLATFORM_CORE_ROOT, "dist");
  const r = rg(["-i", "denali"], distRoot);
  const ok = r.lines.length === 0;
  return {
    id: "g3c_denali_in_platform_core_dist",
    description: "rg -i denali packages/platform-core/dist → 0 (after build)",
    required: true,
    ok,
    detail: ok ? null : truncateDetail(r.lines.slice(0, 15).join("\n")),
  };
}

/** @returns {GuardCheck} */
function checkNoReactInPlatformCore() {
  const srcRoot = path.join(PLATFORM_CORE_ROOT, "src");
  if (!fs.existsSync(srcRoot)) {
    return {
      id: "g4_no_react_imports",
      description: "no react/react-dom imports in platform-core src/",
      required: true,
      ok: false,
      detail: "packages/platform-core/src missing",
    };
  }
  const r = rg(
    [
      "from \"react\"",
      "from 'react'",
      "from \"react-dom\"",
      "from 'react-dom'",
      "from \"react/",
      "from 'react/",
    ],
    srcRoot,
  );
  const ok = r.lines.length === 0;
  return {
    id: "g4_no_react_imports",
    description: "no react/react-dom imports in platform-core src/ (excl. test paths like theme-react)",
    required: true,
    ok,
    detail: ok ? null : truncateDetail(r.lines.join("\n")),
  };
}

/** @returns {GuardCheck} */
function checkFacadeIntegrationSpec() {
  const specPath = path.join(REPO_ROOT, FACADE_INTEGRATION_SPEC);
  if (!fs.existsSync(specPath)) {
    return {
      id: "g12_facade_integration_spec",
      description: "facade-integration.spec.ts executes public PlatformWizardEngine behaviors",
      required: true,
      ok: false,
      detail: `missing ${FACADE_INTEGRATION_SPEC}`,
    };
  }
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
      FACADE_INTEGRATION_TEST_ARG,
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
    !outputHasTestFailures(output) &&
    output.includes("tryFromPlugin → buildRenderPlan matches starter golden snapshot") &&
    output.includes("CANONICAL_TYPE_MISMATCH");
  return {
    id: "g12_facade_integration_spec",
    description: "facade-integration.spec.ts executes public PlatformWizardEngine behaviors",
    required: true,
    ok,
    detail: ok ? "facade integration green" : truncateDetail(output),
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
function checkPhase1ContractBehaviors() {
  const r = spawnSync("pnpm", ["--filter", "@app-tour/platform-core", "run", "test:phase-1"], {
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
    count >= MIN_PHASE_1_BEHAVIOR_TESTS &&
    !outputHasTestFailures(output);
  return {
    id: "g11_phase1_contract_behaviors",
    description: `phase-1.contract.spec.ts ≥ ${MIN_PHASE_1_BEHAVIOR_TESTS} behavioral rows (not count-only gate)`,
    required: true,
    ok,
    detail: ok
      ? `${count} contract tests (${PHASE_1_CONTRACT_SPEC})`
      : truncateDetail(
          count != null
            ? `${count} tests (need ≥ ${MIN_PHASE_1_BEHAVIOR_TESTS})\n${output}`
            : output,
        ),
  };
}

/** @returns {GuardCheck} */
function checkFacadeTestRatio() {
  const testRoot = path.join(PLATFORM_CORE_ROOT, "test");
  const { total, facade, ratio } = measureFacadeTestRatio(testRoot);
  const min = PHASE_1_FACADE_TEST_RATIO_MIN;
  const ok = total > 0 && ratio >= min;
  const pct = `${Math.round(ratio * 100)}%`;
  const minPct = `${Math.round(min * 100)}%`;
  return {
    id: "g13_facade_test_ratio",
    description: `facade-path tests ≥ ${minPct} of closure spec cases (excl. test/unit/**)`,
    required: true,
    ok,
    detail: ok
      ? `${facade}/${total} cases (${pct})`
      : `${facade}/${total} cases (${pct}; need ≥ ${minPct})`,
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
    checkPlatformCoreClosureTestCount(),
    checkPlatformCoreUnitInternalTests(),
    checkPhase1ContractBehaviors(),
    checkFacadeIntegrationSpec(),
    checkFacadeTestRatio(),
    checkAdversarialSpecsExecute(),
    checkNoDenaliInPlatformCore(),
    checkNoDenaliInPlatformCoreTests(),
    checkNoDenaliInPlatformCoreDist(),
    checkNoReactInPlatformCore(),
    checkArchitectureGuard(),
    checkImportBoundaryGuard(),
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
      note: "platform-core: dist + ≥132 tests + facade ratio g13 + workspace-sdk ≥39 + adversarial + denali-free + no react + depcruise",
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
