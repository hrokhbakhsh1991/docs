#!/usr/bin/env node
/**
 * Phase 0.2 — Platform transformation baseline metrics.
 * Usage: node scripts/platform-transformation/baseline-metrics.mjs
 * Output: reports/phase-0-baseline-YYYY-MM-DD.json + .md
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const REPORTS_DIR = path.join(REPO_ROOT, "reports");

const LAYERS = [
  "packages/denali-domain",
  "packages/types/src/denali",
  "packages/shared-contracts",
  "apps/api/src/modules/tours",
  "apps/web/src/features/tours",
  "apps/web/src/components/tours",
  "libs/core",
  "packages/draft-engine",
  "packages/platform-core",
  "packages/workspace-sdk",
];

const COMPOSITE_BYPASS_FILES = [
  "apps/web/src/features/tours/denali/widgets/DenaliProgramContentSection.tsx",
  "apps/web/src/features/tours/denali/widgets/DenaliPricingParticipantSection.tsx",
  "apps/web/src/features/tours/denali/widgets/DenaliDailyItinerarySection.tsx",
  "apps/web/src/features/tours/wizard/denali/steps/DenaliProgramContentSection.tsx",
  "apps/web/src/features/tours/wizard/denali/steps/DenaliPricingParticipantSection.tsx",
  "apps/web/src/features/tours/wizard/denali/steps/DenaliDailyItinerarySection.tsx",
  "apps/web/src/features/tours/wizard/DenaliTourCreationPresetBanner.tsx",
];

const DUAL_STATE_SEED_FILES = [
  "apps/web/src/features/tours/wizard/denali/DenaliCanonicalContext.tsx",
  "apps/web/src/features/tours/wizard/denali/DenaliWizardSyncContext.tsx",
  "apps/web/src/components/tours/wizard/WorkspaceTourWizard.tsx",
  "apps/web/src/features/tours/wizard/denali/hooks/useDenaliCanonicalModel.ts",
  "apps/web/src/features/tours/wizard/denali/denaliCanonicalFormAdapter.ts",
];

const WIZARD_ROOT = path.join(REPO_ROOT, "apps/web/src/features/tours/wizard");
const FORM_CONTROL_RE = /<input|<select|<textarea/i;
const RHF_RE = /\buseFormContext\b|\bregister\s*\(/;
const CANONICAL_RE = /\bupdateCanonical\b|\bDenaliCanonicalContext\b/;

function gitShortSha() {
  const r = spawnSync("git", ["rev-parse", "--short", "HEAD"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  return r.status === 0 ? r.stdout.trim() : "unknown";
}

function hasRg() {
  const r = spawnSync("rg", ["--version"], { encoding: "utf8" });
  return r.status === 0;
}

/** @param {string} pattern @param {string} dir @param {string[]} extraArgs */
function rgLineCount(pattern, dir, extraArgs = []) {
  const abs = path.join(REPO_ROOT, dir);
  if (!fs.existsSync(abs)) return null;
  const args = ["-i", pattern, abs, ...extraArgs];
  const r = spawnSync("rg", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (r.status === 1 && !r.stdout) return 0;
  if (r.status !== 0 && r.status !== 1) return null;
  const lines = r.stdout.trim();
  return lines ? lines.split("\n").length : 0;
}

/** @param {string} pattern @param {string} root */
function rgFileCount(pattern, root = REPO_ROOT) {
  const r = spawnSync(
    "rg",
    ["-l", pattern, root, "--glob", "*.{ts,tsx}", "--glob", "!node_modules", "--glob", "!.next", "--glob", "!dist"],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  if (r.status === 1 && !r.stdout) return 0;
  if (r.status !== 0 && r.status !== 1) return null;
  const lines = r.stdout.trim();
  return lines ? lines.split("\n").length : 0;
}

function walkTsFiles(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (["node_modules", "dist", ".next", "__tests__", "__benchmarks__"].includes(ent.name)) continue;
      walkTsFiles(p, acc);
    } else if (ent.isFile() && /\.(tsx?)$/.test(ent.name)) {
      if (/\.(spec|test)\.(tsx?)$/.test(ent.name)) continue;
      acc.push(p);
    }
  }
  return acc;
}

function countFormControlsInWizard() {
  let matches = 0;
  for (const abs of walkTsFiles(WIZARD_ROOT)) {
    const src = fs.readFileSync(abs, "utf8");
    const m = src.match(new RegExp(FORM_CONTROL_RE.source, "gi"));
    if (m) matches += m.length;
  }
  return matches;
}

function findDualStateFiles() {
  const found = new Set(DUAL_STATE_SEED_FILES);
  const scanRoot = path.join(REPO_ROOT, "apps/web/src/features/tours");
  for (const abs of walkTsFiles(scanRoot)) {
    const rel = path.relative(REPO_ROOT, abs).split(path.sep).join("/");
    const src = fs.readFileSync(abs, "utf8");
    if (RHF_RE.test(src) && CANONICAL_RE.test(src)) found.add(rel);
  }
  return [...found].sort();
}

function fileContentSha256(relPath) {
  const abs = path.join(REPO_ROOT, relPath);
  if (!fs.existsSync(abs)) return { path: relPath, exists: false, sha256: null };
  const hash = crypto.createHash("sha256").update(fs.readFileSync(abs)).digest("hex").slice(0, 16);
  return { path: relPath, exists: true, sha256: hash };
}

function countStrategySymbols() {
  const apiRoot = path.join(REPO_ROOT, "apps/api");
  const pattern = "DENALI_STRATEGY_PROFILES|stripDenali|usesDenaliCanonicalTemplate";
  const r = spawnSync("rg", ["-c", pattern, apiRoot, "--glob", "*.{ts,tsx}"], { encoding: "utf8" });
  if (r.status !== 0 && r.status !== 1) return null;
  let total = 0;
  for (const line of r.stdout.trim().split("\n").filter(Boolean)) {
    const n = Number(line.split(":").pop());
    if (!Number.isNaN(n)) total += n;
  }
  return total;
}

function buildReport() {
  const useRg = hasRg();
  const layers = {};

  for (const layer of LAYERS) {
    const abs = path.join(REPO_ROOT, layer);
    if (!fs.existsSync(abs)) {
      layers[layer] = { denali_token_count: null, missing: true };
      continue;
    }
    layers[layer] = {
      denali_token_count: useRg ? rgLineCount("denali", layer) : null,
      missing: false,
    };
  }

  const composite_bypass_files = COMPOSITE_BYPASS_FILES.map(fileContentSha256);

  return {
    generatedAt: new Date().toISOString(),
    gitSha: gitShortSha(),
    tool: { ripgrep: useRg },
    layers,
    global: {
      denali_import_edges: {
        "@repo/denali-domain": useRg ? rgFileCount("@repo/denali-domain") : null,
        "@repo/types/denali": useRg ? rgFileCount("@repo/types/denali") : null,
      },
      direct_form_controls_wizard: countFormControlsInWizard(),
      strategy_profile_constants: useRg ? countStrategySymbols() : null,
      dual_state_files: findDualStateFiles(),
      composite_bypass_files,
      platform_core_denali_tokens: useRg ? rgLineCount("denali", "packages/platform-core") : null,
      workspace_sdk_denali_tokens: useRg ? rgLineCount("denali", "packages/workspace-sdk") : null,
    },
  };
}

function renderMarkdown(report, jsonRel, dateSlug) {
  const lines = [
    `# Phase 0 platform baseline — ${dateSlug}`,
    "",
    `- **Generated:** ${report.generatedAt}`,
    `- **Git SHA:** \`${report.gitSha}\``,
    `- **JSON:** [${jsonRel}](${jsonRel})`,
    "",
    "## Layers (`denali_token_count`)",
    "",
    "| Layer | Count |",
    "|-------|------:|",
  ];

  for (const [layer, data] of Object.entries(report.layers)) {
    const count = data.missing ? "— (missing)" : String(data.denali_token_count ?? "n/a");
    lines.push(`| \`${layer}\` | ${count} |`);
  }

  const g = report.global;
  lines.push(
    "",
    "## Global",
    "",
    `- **@repo/denali-domain importers:** ${g.denali_import_edges["@repo/denali-domain"] ?? "n/a"}`,
    `- **@repo/types/denali importers:** ${g.denali_import_edges["@repo/types/denali"] ?? "n/a"}`,
    `- **direct_form_controls_wizard:** ${g.direct_form_controls_wizard}`,
    `- **strategy_profile_constants (match count in apps/api):** ${g.strategy_profile_constants ?? "n/a"}`,
    `- **dual_state_files:** ${g.dual_state_files.length}`,
    `- **composite_bypass_files:** ${g.composite_bypass_files.filter((f) => f.exists).length}/${g.composite_bypass_files.length} present`,
    "",
    "See JSON for full file lists and composite hashes.",
  );

  return lines.join("\n") + "\n";
}

function main() {
  const report = buildReport();
  const dateSlug = new Date().toISOString().slice(0, 10);
  const baseName = `phase-0-baseline-${dateSlug}`;

  fs.mkdirSync(REPORTS_DIR, { recursive: true });

  const jsonPath = path.join(REPORTS_DIR, `${baseName}.json`);
  const mdPath = path.join(REPORTS_DIR, `${baseName}.md`);
  const jsonRel = `reports/${baseName}.json`;

  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(mdPath, renderMarkdown(report, jsonRel, dateSlug));

  console.log(`baseline-metrics: wrote ${path.relative(REPO_ROOT, jsonPath)}`);
  console.log(`baseline-metrics: wrote ${path.relative(REPO_ROOT, mdPath)}`);
}

main();
