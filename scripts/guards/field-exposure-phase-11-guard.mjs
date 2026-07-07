#!/usr/bin/env node
/**
 * Field Exposure System — Phase 11 platform exposure plugin guard (Milestone M5).
 *
 * @see docs/dev/workspace-exposure-plugin-contract.mdoc
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const REPO_ROOT = resolve(__dirname, "../..");

const EXPOSURE_DOC = join(REPO_ROOT, "docs/architecture/field-exposure-system.md");
const CONTRACT_DOC = join(REPO_ROOT, "docs/dev/workspace-exposure-plugin-contract.mdoc");
const ARCHITECTURE_README = join(REPO_ROOT, "docs/architecture/README.md");
const PACKAGE_JSON = join(REPO_ROOT, "package.json");
const PRE_COMMIT = join(REPO_ROOT, "scripts/pre-commit-fast.sh");
const CONTRACT = join(REPO_ROOT, "apps/api/test/field-exposure-phase-11-platform.contract.spec.ts");
const SDK_SURFACE = join(REPO_ROOT, "packages/workspace-sdk/src/exposure/workspace-exposure-surface.ts");
const SURFACES_SERVICE = join(REPO_ROOT, "apps/api/src/exposure/workspace-exposure-surfaces.service.ts");
const RESOLVER = join(REPO_ROOT, "apps/api/src/exposure/resolve-workspace-exposure-surfaces.ts");
const DENALI_PLUGIN = join(REPO_ROOT, "packages/workspaces/denali/src/denali.plugin.ts");
const DENALI_EXPOSURE_SURFACE = join(
  REPO_ROOT,
  "packages/workspaces/denali/src/exposure/denali-exposure.surface.ts",
);
const STARTER_EXPOSURE = join(
  REPO_ROOT,
  "packages/workspaces/starter/src/exposure/starter-exposure.surface.ts",
);
const STARTER_SPEC = join(
  REPO_ROOT,
  "packages/workspaces/starter/test/starter-exposure-surfaces.spec.ts",
);

function readText(path) {
  if (!existsSync(path)) return null;
  return readFileSync(path, "utf8");
}

function main() {
  const failures = [];

  const doc = readText(EXPOSURE_DOC);
  for (const marker of [
    "## Enterprise Closure — Milestone M5 (Platform Scale)",
    "workspace-exposure-plugin-contract.mdoc",
    "guard:field-exposure-phase-11",
    "field-exposure-phase-11-platform.contract.spec.ts",
    "resolve-workspace-exposure-surfaces.ts",
  ]) {
    if (!doc?.includes(marker)) {
      failures.push(`field-exposure-system.md missing M5 marker: ${marker}`);
    }
  }

  const contractDoc = readText(CONTRACT_DOC);
  if (contractDoc === null) {
    failures.push("missing docs/dev/workspace-exposure-plugin-contract.mdoc");
  } else if (!contractDoc.includes("validateExposureSurface")) {
    failures.push("workspace-exposure-plugin-contract.mdoc must document validateExposureSurface");
  }

  const readme = readText(ARCHITECTURE_README);
  if (!readme?.includes("guard:field-exposure-phase-11")) {
    failures.push("docs/architecture/README.md must reference guard:field-exposure-phase-11");
  }

  const packageJson = readText(PACKAGE_JSON);
  if (!packageJson?.includes('"guard:field-exposure-phase-11"')) {
    failures.push("package.json must wire guard:field-exposure-phase-11");
  }

  const preCommit = readText(PRE_COMMIT);
  if (!preCommit?.includes("field-exposure-phase-11-guard.mjs")) {
    failures.push("pre-commit-fast.sh must run field-exposure-phase-11-guard.mjs");
  }

  for (const path of [CONTRACT, SDK_SURFACE, RESOLVER, DENALI_EXPOSURE_SURFACE, STARTER_EXPOSURE, STARTER_SPEC]) {
    if (!existsSync(path)) {
      failures.push(`missing ${path.replace(`${REPO_ROOT}/`, "")}`);
    }
  }

  const pluginContract = readText(
    join(REPO_ROOT, "packages/workspace-sdk/src/plugin/workspace-plugin.contract.ts"),
  );
  if (!pluginContract?.includes("exposureSurface?: WorkspaceExposureSurface")) {
    failures.push("WorkspacePlugin must declare optional exposureSurface");
  }

  const surfacesService = readText(SURFACES_SERVICE);
  if (surfacesService?.includes("@app-tour/workspace-denali/exposure")) {
    failures.push("workspace-exposure-surfaces.service.ts must not import Denali exposure directly");
  }
  if (!surfacesService?.includes("listOperatorVisibleExposureSurfaceDefinitions")) {
    failures.push("workspace-exposure-surfaces.service.ts must resolve plugin exposure surfaces");
  }

  const denaliPlugin = readText(DENALI_PLUGIN);
  if (!denaliPlugin?.includes("exposureSurface:")) {
    failures.push("denali.plugin.ts must wire exposureSurface");
  }

  const starterPlugin = readText(
    join(REPO_ROOT, "packages/workspaces/starter/src/starter.plugin.ts"),
  );
  if (!starterPlugin?.includes("starterExposureSurface")) {
    failures.push("starter.plugin.ts must wire starterExposureSurface");
  }

  if (failures.length > 0) {
    console.error("field-exposure-phase-11-guard: FAIL");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log("field-exposure-phase-11-guard: PASS");
}

main();
