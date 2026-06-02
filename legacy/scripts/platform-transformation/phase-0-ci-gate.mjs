#!/usr/bin/env node
/**
 * Phase 0.3 — Record CI / build / smoke gate results.
 * Usage: node scripts/platform-transformation/phase-0-ci-gate.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const REPORTS_DIR = path.join(REPO_ROOT, "reports");
const WEB_DIR = path.join(REPO_ROOT, "apps/web");

const SMOKE_SPECS = [
  "src/features/tours/__tests__/smoke/12-denali-verification-matrix.spec.ts",
  "src/features/tours/__tests__/smoke/04-tour-wizard-urban-profile.spec.ts",
  "src/features/tours/__tests__/smoke/10-denali-wizard-shell.spec.ts",
];

/** @typedef {{ name: string, command: string, cwd?: string, required: boolean }} GateDef */

/** @type {GateDef[]} */
const GATES = [
  {
    name: "ci_integrity",
    command: "pnpm run ci:integrity",
    cwd: REPO_ROOT,
    required: true,
  },
  {
    name: "web_build",
    command: "pnpm --filter @apps/web build",
    cwd: REPO_ROOT,
    required: true,
  },
  {
    name: "structural_guards",
    command: "pnpm --filter @apps/web test:structural-guards",
    cwd: REPO_ROOT,
    required: false,
  },
  {
    name: "api_structural_integrity",
    command: "pnpm exec tsx src/scripts/audit-structural-integrity.ts",
    cwd: path.join(REPO_ROOT, "apps/api"),
    required: false,
  },
  {
    name: "root_build_known_issue",
    command: "pnpm run build",
    cwd: REPO_ROOT,
    required: false,
  },
  {
    name: "draft_engine_test",
    command: "pnpm --filter @repo/draft-engine run test",
    cwd: REPO_ROOT,
    required: false,
  },
];

function gitShortSha() {
  const r = spawnSync("git", ["rev-parse", "--short", "HEAD"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  return r.status === 0 ? r.stdout.trim() : "unknown";
}

/** @param {GateDef} gate */
function runGate(gate) {
  const start = Date.now();
  const r = spawnSync(gate.command, {
    shell: true,
    cwd: gate.cwd ?? REPO_ROOT,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    env: { ...process.env, FORCE_COLOR: "0" },
  });
  const durationMs = Date.now() - start;
  return {
    name: gate.name,
    command: gate.command,
    required: gate.required,
    ok: r.status === 0,
    exitCode: r.status ?? 1,
    durationMs,
    stderrTail: (r.stderr ?? "").trim().slice(-2000) || null,
    stdoutTail: r.status !== 0 ? (r.stdout ?? "").trim().slice(-2000) || null : null,
  };
}

function runSmokeSubset() {
  const start = Date.now();
  const buildSmoke = spawnSync("pnpm run build:smoke", {
    shell: true,
    cwd: WEB_DIR,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    env: { ...process.env, CI: "1", FORCE_COLOR: "0" },
  });
  if (buildSmoke.status !== 0) {
    return {
      name: "playwright_smoke_subset",
      command: `build:smoke + playwright (${SMOKE_SPECS.length} specs)`,
      required: true,
      ok: false,
      exitCode: buildSmoke.status ?? 1,
      durationMs: Date.now() - start,
      stderrTail: (buildSmoke.stderr ?? "").trim().slice(-2000) || null,
      stdoutTail: (buildSmoke.stdout ?? "").trim().slice(-2000) || null,
    };
  }

  const smokePort = process.env.PW_SMOKE_PORT?.trim() || "3010";
  const smokeBaseUrl = `http://workspace-test.localhost:${smokePort}`;
  const specArgs = SMOKE_SPECS.join(" ");
  const pwCmd = `CI=1 PW_NO_REUSE_SERVER=1 pnpm exec playwright test -c playwright.smoke.config.ts ${specArgs}`;
  const pw = spawnSync(pwCmd, {
    shell: true,
    cwd: WEB_DIR,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    env: {
      ...process.env,
      FORCE_COLOR: "0",
      PORT: smokePort,
      TEST_PLATFORM_BASE_URL: smokeBaseUrl,
    },
  });

  return {
    name: "playwright_smoke_subset",
    command: pwCmd,
    required: true,
    ok: pw.status === 0,
    exitCode: pw.status ?? 1,
    durationMs: Date.now() - start,
    stderrTail: (pw.stderr ?? "").trim().slice(-2000) || null,
    stdoutTail: pw.status !== 0 ? (pw.stdout ?? "").trim().slice(-2000) || null : null,
  };
}

function knownIssues(nodeVersion) {
  return [
    {
      id: "node_engine",
      severity: "warn",
      note: "Root package.json wants Node 24; record actual runtime below.",
      observed: nodeVersion,
    },
    {
      id: "root_pnpm_build",
      severity: "info",
      note: "Full `pnpm run build` may fail on @repo/shared-contracts → @repo/types/denali; not a Phase 0.3 blocker.",
      gate: "root_build_known_issue",
    },
    {
      id: "legacy_archive_docs",
      severity: "info",
      note: "quarantine-integrity-check.md / final-trace-audit.md may mention legacy_archive; runtime imports are zero.",
    },
    {
      id: "e2e_isolation",
      severity: "info",
      note: "pnpm test:e2e:isolation requires Docker DB; run before large merges, not required for 0.3 exit.",
    },
  ];
}

function renderMarkdown(report, jsonRel, dateSlug) {
  const lines = [
    `# Phase 0 CI gate — ${dateSlug}`,
    "",
    `- **Generated:** ${report.generatedAt}`,
    `- **Git SHA:** \`${report.gitSha}\``,
    `- **Node:** ${report.environment.node}`,
    `- **JSON:** [${jsonRel}](${jsonRel})`,
    "",
    "## Gates",
    "",
    "| Gate | Required | Result | Duration |",
    "|------|----------|--------|----------:|",
  ];

  for (const g of report.gates) {
    const result = g.ok ? "PASS" : "FAIL";
    const sec = (g.durationMs / 1000).toFixed(1);
    lines.push(`| ${g.name} | ${g.required ? "yes" : "no"} | ${result} | ${sec}s |`);
  }

  lines.push("", "## Phase 0.3 exit", "");
  const required = report.gates.filter((g) => g.required);
  const requiredOk = required.every((g) => g.ok);
  lines.push(requiredOk ? "- **0.3 required gates:** PASS" : "- **0.3 required gates:** FAIL");

  lines.push("", "## Known issues (baseline)", "");
  for (const k of report.knownIssues) {
    lines.push(`- **${k.id}** (${k.severity}): ${k.note}`);
  }

  const failed = report.gates.filter((g) => !g.ok);
  if (failed.length) {
    lines.push("", "## Failure tails", "");
    for (const g of failed) {
      lines.push(`### ${g.name}`, "");
      if (g.stderrTail) lines.push("```", g.stderrTail, "```", "");
    }
  }

  return lines.join("\n") + "\n";
}

function main() {
  const nodeVersion = process.version;
  const gateResults = GATES.map(runGate);
  gateResults.push(runSmokeSubset());

  const report = {
    generatedAt: new Date().toISOString(),
    gitSha: gitShortSha(),
    phase: "0.3",
    environment: { node: nodeVersion, platform: process.platform },
    gates: gateResults,
    knownIssues: knownIssues(nodeVersion),
    exit03: {
      requiredPass: gateResults.filter((g) => g.required).every((g) => g.ok),
    },
  };

  const dateSlug = new Date().toISOString().slice(0, 10);
  const baseName = `phase-0-ci-gate-${dateSlug}`;
  fs.mkdirSync(REPORTS_DIR, { recursive: true });

  const jsonPath = path.join(REPORTS_DIR, `${baseName}.json`);
  const mdPath = path.join(REPORTS_DIR, `${baseName}.md`);
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(mdPath, renderMarkdown(report, `reports/${baseName}.json`, dateSlug));

  console.log(`phase-0-ci-gate: wrote ${path.relative(REPO_ROOT, jsonPath)}`);
  console.log(`phase-0-ci-gate: required gates ${report.exit03.requiredPass ? "PASS" : "FAIL"}`);

  const allowSmokeFail = process.env.PHASE0_ALLOW_SMOKE_FAIL === "1";
  if (!report.exit03.requiredPass && !allowSmokeFail) process.exit(1);
  if (!report.exit03.requiredPass && allowSmokeFail) {
    console.warn("phase-0-ci-gate: required gates incomplete (PHASE0_ALLOW_SMOKE_FAIL=1)");
  }
}

main();
