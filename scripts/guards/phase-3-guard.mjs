#!/usr/bin/env node
/**
 * Phase 3 — static foundation guard.
 * Application certification: scripts/guards/phase-3-apps-cert.mjs
 * Full release path: pnpm run phase-3:gate (guard + apps-cert).
 *
 * Usage: node scripts/guards/phase-3-guard.mjs
 * Env: PHASE_3_GATE_REPORT=2026-06-03 (optional report date slug)
 *
 * @see docs/phase-3/phase-3-guard-apps-cert-split.mdoc
 */
import fs from "node:fs";
import path from "node:path";

import {
  REPO_ROOT,
  checkCommand,
  writePhase3Report,
} from "./lib/phase-3-check-helpers.mjs";

const REPORT_DATE =
  process.env.PHASE_3_GATE_REPORT ?? new Date().toISOString().slice(0, 10);

/** @typedef {{ id: string, enforcementId?: string, description: string, required: boolean, ok: boolean, detail?: string | null }} GuardCheck */

/** @returns {GuardCheck} */
function checkUiPrimitivesSubpathsOptional() {
  const pkgPath = path.join(REPO_ROOT, "packages/ui-primitives/package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  const exports = Object.keys(pkg.exports ?? {});
  const hasSelect = exports.includes("./select");
  const hasCheckbox = exports.includes("./checkbox");
  return {
    id: "p3_ui_select_checkbox_optional",
    enforcementId: "P3-UI-01/02",
    description: "Select/Checkbox subpaths (optional until 3.3.x)",
    required: false,
    ok: true,
    detail: `select=${hasSelect} checkbox=${hasCheckbox}`,
  };
}

const DENALI_CORE_SCAN_ROOTS = [
  "packages/platform-core/src",
  "packages/workspaces/starter/src",
  "packages/theme-react/src",
  "packages/ui-primitives/src",
];

const DENALI_SOURCE_FILE = /\.(ts|tsx|js|jsx|mjs|cjs)$/i;
const DENALI_SPEC_FILE = /\.spec\.(ts|tsx)$/i;
const DENALI_PATTERN = /denali/i;

function listDenaliCoreSourceFiles(rootDir, out = []) {
  if (!fs.existsSync(rootDir)) return out;
  for (const ent of fs.readdirSync(rootDir, { withFileTypes: true })) {
    const full = path.join(rootDir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "test" || ent.name === "node_modules" || ent.name === "dist") continue;
      listDenaliCoreSourceFiles(full, out);
      continue;
    }
    if (!DENALI_SOURCE_FILE.test(ent.name) || DENALI_SPEC_FILE.test(ent.name)) continue;
    out.push(full);
  }
  return out;
}

function findDenaliCoreHits() {
  const hits = [];
  for (const rel of DENALI_CORE_SCAN_ROOTS) {
    const root = path.join(REPO_ROOT, rel);
    for (const file of listDenaliCoreSourceFiles(root)) {
      const text = fs.readFileSync(file, "utf8");
      if (!DENALI_PATTERN.test(text)) continue;
      const relFile = path.relative(REPO_ROOT, file);
      const line = text.split("\n").findIndex((row) => DENALI_PATTERN.test(row)) + 1;
      hits.push(`${relFile}:${line}`);
    }
  }
  return hits;
}

function truncateDetail(text) {
  if (text == null) return null;
  const t = String(text).trim();
  if (t.length <= 2000) return t;
  return `${t.slice(0, 2000)}\n… (truncated)`;
}

/** @returns {GuardCheck} */
function checkNoDenaliInPhase3Scope() {
  // Phase 6+ — Denali lives under packages/workspaces/denali and approved apps/web|api
  // wiring; kernel + design-system packages stay Denali-free (P3-E-WS-01 / no core creep).
  const hits = findDenaliCoreHits();
  const ok = hits.length === 0;
  return {
    id: "p3_no_denali",
    enforcementId: "P3-E-WS-01",
    description:
      "denali-free scan: platform-core/starter/theme-react/ui-primitives src (Phase 6 apps/sdk exempt)",
    required: true,
    ok,
    detail: ok ? null : truncateDetail(hits.join("\n")),
  };
}

/** @returns {GuardCheck} */
function checkAppsWebExists() {
  const ok = fs.existsSync(path.join(REPO_ROOT, "apps/web/package.json"));
  return {
    id: "p3_apps_web_exists",
    enforcementId: "P3-E-APP-HOOK",
    description: "apps/web package exists",
    required: true,
    ok,
    detail: null,
  };
}

/** @returns {GuardCheck} */
function checkAppsApiExists() {
  const ok = fs.existsSync(path.join(REPO_ROOT, "apps/api/package.json"));
  return {
    id: "p3_apps_api_exists",
    enforcementId: "P3-E-DB-01",
    description: "apps/api package exists",
    required: true,
    ok,
    detail: null,
  };
}

function main() {
  const checks = [
    checkCommand(
      "p3_doc_gate",
      "P3-E-DOC-GATE",
      "pnpm run doc-gate (Docs-as-Code scaffold — required before 3.1)",
      ["run", "doc-gate"],
    ),
    checkAppsWebExists(),
    checkAppsApiExists(),
    checkCommand(
      "p3_audit_boundary",
      "P3-E-BARREL",
      "pnpm run audit-boundary",
      ["run", "audit-boundary"],
    ),
    checkCommand(
      "p3_import_boundary",
      "P3-E-BARREL",
      "pnpm run guard:import-boundary",
      ["run", "guard:import-boundary"],
    ),
    checkCommand(
      "p3_guard_architecture",
      "P3-E-WS-01",
      "pnpm run guard:architecture",
      ["run", "guard:architecture"],
    ),
    checkCommand(
      "p3_artifact_surface",
      "P3-E-ARTIFACT",
      "pnpm run guard:artifact-surface",
      ["run", "guard:artifact-surface"],
    ),
    checkCommand(
      "p3_theme_react_verify_exports",
      "P3-E-L01",
      "pnpm --filter @app-tour/theme-react run verify:exports",
      ["--filter", "@app-tour/theme-react", "run", "verify:exports"],
    ),
    checkCommand(
      "p3_canonical_sync",
      "P3-E-CANONICAL-34",
      "apps/api validate:canonical-sync",
      ["--filter", "@apps/api", "run", "validate:canonical-sync"],
    ),
    checkUiPrimitivesSubpathsOptional(),
    checkNoDenaliInPhase3Scope(),
  ];

  writePhase3Report({
    baseName: `phase-3-guard-${REPORT_DATE}`,
    phase: "3.5-static",
    reportDate: REPORT_DATE,
    gateCommand: "pnpm run phase-3:guard",
    doc: "docs/phase-3/phase-3-guard-apps-cert-split.mdoc",
    note: "Phase 3 static foundation — doc/barrel/architecture/artifact/canonical/denali (apps cert = phase-3:apps-cert)",
    logPrefix: "phase-3-guard",
    checks,
  });
}

main();
