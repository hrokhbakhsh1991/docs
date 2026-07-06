#!/usr/bin/env node
/**
 * I6 — surface visual regression matrix (marketing + portal × denali/urban/guest-club).
 * Fast guard: specs, configs, snapshots, and package scripts must exist.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const MARKETING = path.join(REPO_ROOT, "apps/marketing");
const PORTAL = path.join(REPO_ROOT, "apps/portal");

const MARKETING_MATRIX = [
  {
    workspace: "denali",
    spec: "tests/e2e/marketing-shell-visual.spec.ts",
    config: "playwright.marketing-visual.config.ts",
    script: "test:smoke:visual",
    snapshots: ["denali-home-shell-header.png", "denali-catalog-shell-chrome.png"],
    testIds: ["SMK-MKT-VIS-01", "SMK-MKT-VIS-02"],
  },
  {
    workspace: "urban",
    spec: "tests/e2e/marketing-shell-visual-urban.spec.ts",
    config: "playwright.marketing-visual-urban.config.ts",
    script: "test:smoke:visual:urban",
    snapshots: ["urban-home-shell-header.png", "urban-catalog-shell-chrome.png"],
    testIds: ["SMK-MKT-VIS-urban-01", "SMK-MKT-VIS-urban-02"],
  },
  {
    workspace: "guest-club",
    spec: "tests/e2e/marketing-shell-visual-guest-club.spec.ts",
    config: "playwright.marketing-visual-guest-club.config.ts",
    script: "test:smoke:visual:guest-club",
    snapshots: ["guest-club-home-shell-header.png", "guest-club-catalog-shell-chrome.png"],
    testIds: ["SMK-MKT-VIS-guest-01", "SMK-MKT-VIS-guest-02"],
  },
];

const PORTAL_MATRIX = [
  {
    workspace: "denali",
    spec: "tests/e2e/portal-shell-visual.spec.ts",
    config: "playwright.portal-visual.config.ts",
    script: "test:smoke:visual",
    snapshots: ["denali-portal-shell-header.png"],
    testIds: ["SMK-PTL-VIS-01"],
  },
  {
    workspace: "urban",
    spec: "tests/e2e/portal-shell-visual-urban.spec.ts",
    config: "playwright.portal-visual-urban.config.ts",
    script: "test:smoke:visual:urban",
    snapshots: ["urban-portal-shell-header.png"],
    testIds: ["SMK-PTL-VIS-urban-01"],
  },
  {
    workspace: "guest-club",
    spec: "tests/e2e/portal-shell-visual-guest-club.spec.ts",
    config: "playwright.portal-visual-guest-club.config.ts",
    script: "test:smoke:visual:guest-club",
    snapshots: ["guest-club-portal-shell-header.png"],
    testIds: ["SMK-PTL-VIS-guest-01"],
  },
];

/** @type {string[]} */
const violations = [];

/**
 * @param {string} appRoot
 * @param {string} appLabel
 * @param {typeof MARKETING_MATRIX} matrix
 * @param {string} matrixScript
 * @param {Set<string>} [optionalSnapshotWorkspaces]
 */
function verifyMatrix(appRoot, appLabel, matrix, matrixScript, optionalSnapshotWorkspaces = new Set()) {
  const pkgPath = path.join(appRoot, "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  if (!pkg.scripts?.[matrixScript]) {
    violations.push(`${appLabel}/package.json missing ${matrixScript}`);
  }
  for (const entry of matrix) {
    const specPath = path.join(appRoot, entry.spec);
    const configPath = path.join(appRoot, entry.config);
    if (!existsSync(specPath)) {
      violations.push(`${appLabel}: missing spec ${entry.spec}`);
    }
    if (!existsSync(configPath)) {
      violations.push(`${appLabel}: missing config ${entry.config}`);
    }
    if (!pkg.scripts?.[entry.script]) {
      violations.push(`${appLabel}: missing script ${entry.script}`);
    }
    if (existsSync(specPath)) {
      const spec = readFileSync(specPath, "utf8");
      for (const id of entry.testIds) {
        if (!spec.includes(id)) {
          violations.push(`${entry.spec} missing ${id}`);
        }
      }
    }
    const snapDir = `${specPath}-snapshots`;
    for (const snap of entry.snapshots) {
      if (!existsSync(path.join(snapDir, snap))) {
        if (optionalSnapshotWorkspaces.has(entry.workspace)) {
          console.warn(
            `guard-surface-visual-matrix: optional snapshot pending ${appLabel}/${entry.workspace}/${snap}`
          );
          continue;
        }
        violations.push(`${appLabel}/${entry.workspace}: missing snapshot ${snap}`);
      }
    }
  }
}

verifyMatrix(MARKETING, "marketing", MARKETING_MATRIX, "test:smoke:visual:matrix");
verifyMatrix(PORTAL, "portal", PORTAL_MATRIX, "test:smoke:visual:matrix");

if (violations.length > 0) {
  console.error("guard-surface-visual-matrix: FAIL");
  for (const v of violations) {
    console.error(`  - ${v}`);
  }
  process.exit(1);
}

console.log(
  `guard-surface-visual-matrix: PASS (marketing ${MARKETING_MATRIX.length} + portal ${PORTAL_MATRIX.length} workspaces)`
);
