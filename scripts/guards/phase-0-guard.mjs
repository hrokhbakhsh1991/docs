#!/usr/bin/env node
/**
 * Phase 0.5 — CI gate checks for app-tour foundation.
 * Usage: node scripts/guards/phase-0-guard.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  FOUNDATION_GATE_IMPORT_BOUNDARY_SCAN_ROOTS,
  IMPORT_BOUNDARY_SCAN_ROOTS,
} from "./foundation-gate-config.mjs";
import { guardSubprocessEnv } from "./lib/guard-subprocess-env.mjs";
import { guardDepcruiseBin } from "./lib/guard-require.mjs";

const IS_FOUNDATION_SCOPE = process.env.PHASE_0_GUARD_SCOPE === "foundation";
const IS_INTEGRATION_REPORT = process.env.PHASE_0_GUARD_REPORT?.trim() === "integration";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const REPORTS_DIR = path.join(REPO_ROOT, "reports");
const IMPORT_SCAN_ROOTS_REL = IS_FOUNDATION_SCOPE
  ? FOUNDATION_GATE_IMPORT_BOUNDARY_SCAN_ROOTS
  : IMPORT_BOUNDARY_SCAN_ROOTS;
const UI_PRIMITIVES_PKG = path.join(REPO_ROOT, "packages/ui-primitives");
const RUNTIME_DEP_SPECIFIERS = /^react$|^react-dom$|^react\/|^react-dom\/|^@app-tour\//;
const DETAIL_MAX = 2000;

/** @typedef {{ id: string, description: string, required: boolean, ok: boolean, detail?: string | null }} GuardCheck */

function gitShortSha() {
  const r = spawnSync("git", ["rev-parse", "--short", "HEAD"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    env: guardSubprocessEnv(),
  });
  return r.status === 0 ? r.stdout.trim() : "unknown";
}

function truncateDetail(text) {
  if (text == null) return null;
  const t = String(text).trim();
  if (t.length <= DETAIL_MAX) return t;
  return `${t.slice(0, DETAIL_MAX)}\n… (truncated)`;
}

/** @returns {GuardCheck} */
function checkImportBoundaryGuard() {
  const r = spawnSync("pnpm", ["run", "guard:import-boundary"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    shell: true,
    maxBuffer: 8 * 1024 * 1024,
    env: guardSubprocessEnv({
      PHASE_0_GUARD_SCOPE: IS_FOUNDATION_SCOPE ? "foundation" : "",
    }),
  });
  const ok = r.status === 0;
  return {
    id: "g4b_import_boundary",
    description: IS_FOUNDATION_SCOPE
      ? "pnpm run guard:import-boundary (workspace-sdk only)"
      : "pnpm run guard:import-boundary",
    required: true,
    ok,
    detail: ok ? null : truncateDetail((r.stdout ?? r.stderr ?? "").trim()) || `exit ${r.status}`,
  };
}

/** @returns {GuardCheck} */
function checkArchitectureGuard() {
  const depcruiseConfig = path.join(REPO_ROOT, "dependency-cruiser.config.js");
  const depcruiseBin = guardDepcruiseBin();
  const r = IS_FOUNDATION_SCOPE
    ? spawnSync(
        process.execPath,
        [
          depcruiseBin,
          "packages/workspace-sdk",
          "packages/config",
          "--config",
          depcruiseConfig,
          "--output-type",
          "err",
        ],
        {
          cwd: REPO_ROOT,
          encoding: "utf8",
          shell: false,
          maxBuffer: 8 * 1024 * 1024,
          // H-01: exclude denali-breach negative fixture from crawl (see dependency-cruiser.config.js)
          env: guardSubprocessEnv({ DEPCRUISE_MONOREPO_GUARD: "1" }),
        }
      )
    : spawnSync(process.execPath, [path.join(__dirname, "lib/depcruise-architecture.mjs")], {
        cwd: REPO_ROOT,
        encoding: "utf8",
        shell: false,
        maxBuffer: 8 * 1024 * 1024,
        env: guardSubprocessEnv(),
      });
  const ok = r.status === 0;
  return {
    id: "g4_depcruise_architecture",
    description: IS_FOUNDATION_SCOPE
      ? "depcruise packages/workspace-sdk packages/config"
      : "pnpm run guard:architecture",
    required: true,
    ok,
    detail: ok ? null : truncateDetail((r.stdout ?? r.stderr ?? "").trim()) || `exit ${r.status}`,
  };
}

/** @returns {GuardCheck} */
function checkInvariantManifest() {
  const r = spawnSync("pnpm", ["--filter", "@app-tour/workspace-sdk", "run", "test:invariants"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    shell: true,
    maxBuffer: 8 * 1024 * 1024,
    env: guardSubprocessEnv({ NODE_ENV: "test" }),
  });
  const ok = r.status === 0;
  return {
    id: "g_invariant_manifest",
    description:
      "pnpm --filter @app-tour/workspace-sdk run test:invariants (5 behavioral invariants — H-03)",
    required: true,
    ok,
    detail: ok ? null : truncateDetail((r.stdout ?? r.stderr ?? "").trim()) || `exit ${r.status}`,
  };
}

function listSourceFiles(dir) {
  /** @type {string[]} */
  const out = [];
  if (!fs.existsSync(dir)) return out;
  const walk = (d) => {
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (/\.tsx?$/.test(ent.name) && !/\.spec\.tsx?$/.test(ent.name)) out.push(p);
    }
  };
  walk(dir);
  return out;
}

function extractRuntimeSpecifiers(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  /** @type {Set<string>} */
  const specs = new Set();
  const patterns = [
    /from\s+["']([^"']+)["']/g,
    /import\s*\(\s*["']([^"']+)["']\s*\)/g,
    /import\s+["']([^"']+)["']/g,
  ];
  for (const re of patterns) {
    for (const m of text.matchAll(re)) {
      const spec = m[1];
      if (RUNTIME_DEP_SPECIFIERS.test(spec)) specs.add(spec);
    }
  }
  return [...specs];
}

function packageNameFromSpecifier(spec, dependencies) {
  if (spec.startsWith("@app-tour/")) {
    const parts = spec.split("/");
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : spec;
  }
  if (spec === "react" || spec.startsWith("react/")) return "react";
  if (spec === "react-dom" || spec.startsWith("react-dom/")) return "react-dom";
  return spec;
}

/** @returns {GuardCheck} */
function checkUiPrimitivesRuntimeDeps() {
  const pkgJsonPath = path.join(UI_PRIMITIVES_PKG, "package.json");
  const srcDir = path.join(UI_PRIMITIVES_PKG, "src");
  if (!fs.existsSync(pkgJsonPath) || !fs.existsSync(srcDir)) {
    return {
      id: "g6_runtime_deps_honesty",
      description: "@app-tour/ui-primitives src/ runtime imports must be in dependencies",
      required: true,
      ok: false,
      detail: "packages/ui-primitives missing package.json or src/",
    };
  }

  const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));
  const declared = new Set(Object.keys(pkg.dependencies ?? {}));
  /** @type {string[]} */
  const violations = [];

  for (const file of listSourceFiles(srcDir)) {
    for (const spec of extractRuntimeSpecifiers(file)) {
      const pkgName = packageNameFromSpecifier(spec, declared);
      if (!declared.has(pkgName)) {
        violations.push(
          `${path.relative(REPO_ROOT, file)}: "${spec}" → "${pkgName}" not in dependencies (peer/dev only is FAIL)`
        );
      }
    }
  }

  const ok = violations.length === 0;
  return {
    id: "g6_runtime_deps_honesty",
    description:
      "@app-tour/ui-primitives: react/react-dom/@app-tour/* used in src/ must be package.json dependencies",
    required: true,
    ok,
    detail: ok ? null : truncateDetail(violations.slice(0, 20).join("\n")),
  };
}

/** @returns {GuardCheck} */
function checkDocSync() {
  const r = spawnSync("pnpm", ["run", "guard:doc-sync"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    shell: true,
    maxBuffer: 8 * 1024 * 1024,
    env: guardSubprocessEnv(
      IS_FOUNDATION_SCOPE ? { PHASE_0_GUARD_SCOPE: "foundation", DOC_SYNC_SCOPE: "foundation" } : {}
    ),
  });
  const ok = r.status === 0;
  return {
    id: "g7_doc_sync",
    description: "pnpm run guard:doc-sync",
    required: true,
    ok,
    detail: ok ? null : truncateDetail((r.stdout ?? r.stderr ?? "").trim()) || `exit ${r.status}`,
  };
}

function renderMarkdown(report, jsonRel, dateSlug, titleLabel) {
  const lines = [
    `# ${titleLabel} — ${dateSlug}`,
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
  lines.push(report.exit05.pass ? "- **Phase 0.5 gate:** PASS" : "- **Phase 0.5 gate:** FAIL");

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
    checkArchitectureGuard(),
    checkImportBoundaryGuard(),
    ...(IS_FOUNDATION_SCOPE ? [] : [checkUiPrimitivesRuntimeDeps()]),
    checkDocSync(),
  ];

  const requiredOk = checks.filter((c) => c.required).every((c) => c.ok);

  const report = {
    generatedAt: new Date().toISOString(),
    gitSha: gitShortSha(),
    phase: IS_FOUNDATION_SCOPE ? "0.5-foundation" : "0.5",
    gateScope: {
      script: "phase-0-guard.mjs",
      scope: IS_FOUNDATION_SCOPE ? "foundation-gate" : "integration-guard",
      foundationGate:
        "pnpm run phase-0:foundation-gate — workspace-sdk + config only (Phase 0 closure)",
      integrationGate:
        "pnpm run phase-0:integration-gate — full monorepo build/test + trunk guards (REM-013)",
      phase0ClosureContract:
        "pnpm run test:phase-0 — phase-0.contract.spec.ts (dist + denali + legacy + invariant manifest; H-06)",
      importBoundaryScanRoots: IMPORT_SCAN_ROOTS_REL,
      countThresholdsRetired: IS_FOUNDATION_SCOPE,
    },
    checks,
    exit05: {
      pass: requiredOk,
      note: IS_FOUNDATION_SCOPE
        ? "foundation-gate: test:phase-0 (phase-0.contract.spec.ts) + scoped depcruise/import + doc-sync"
        : "phase-0 guard: full import-boundary scope + ui-primitives runtime deps",
    },
  };

  const dateSlug = new Date().toISOString().slice(0, 10);
  const baseName = IS_INTEGRATION_REPORT
    ? `phase-0-integration-gate-${dateSlug}`
    : IS_FOUNDATION_SCOPE
      ? `phase-0-foundation-gate-${dateSlug}`
      : `phase-0-gate-${dateSlug}`;
  const titleLabel = IS_INTEGRATION_REPORT
    ? "Phase 0 integration gate"
    : IS_FOUNDATION_SCOPE
      ? "Phase 0 foundation gate"
      : "Phase 0 gate";
  fs.mkdirSync(REPORTS_DIR, { recursive: true });

  const jsonPath = path.join(REPORTS_DIR, `${baseName}.json`);
  const mdPath = path.join(REPORTS_DIR, `${baseName}.md`);
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(
    mdPath,
    renderMarkdown(report, `reports/${baseName}.json`, dateSlug, titleLabel)
  );

  console.log(`phase-0-guard: wrote ${path.relative(REPO_ROOT, jsonPath)}`);
  console.log(`phase-0-guard: ${requiredOk ? "PASS" : "FAIL"}`);

  for (const c of checks) {
    console.log(`  ${c.ok ? "✓" : "✗"} ${c.id}`);
  }

  if (!requiredOk) process.exit(1);
}

main();
