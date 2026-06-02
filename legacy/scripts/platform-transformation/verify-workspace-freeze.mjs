#!/usr/bin/env node
/**
 * Phase 0.4 — Verify reports/phase-0-workspace-freeze.json matches
 * TOUR_FORM_PROFILE_VALUES and workspace registry wizardMode.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const FREEZE_PATH = path.join(REPO_ROOT, "reports/phase-0-workspace-freeze.json");
const PROFILE_TS = path.join(REPO_ROOT, "packages/types/src/tour-form-profile.ts");
const REGISTRY_TS = path.join(
  REPO_ROOT,
  "packages/shared-contracts/src/tours/workspace-registry.ts",
);
const DENALI_TS = path.join(
  REPO_ROOT,
  "packages/shared-contracts/src/tours/workspaces/denali.ts",
);
const ARCTIC_TS = path.join(
  REPO_ROOT,
  "packages/shared-contracts/src/tours/workspaces/arctic.ts",
);

function gitShortSha() {
  const r = spawnSync("git", ["rev-parse", "--short", "HEAD"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  return r.status === 0 ? r.stdout.trim() : "unknown";
}

function parseTourFormProfileValues() {
  const src = fs.readFileSync(PROFILE_TS, "utf8");
  const m = src.match(/TOUR_FORM_PROFILE_VALUES\s*=\s*\[([\s\S]*?)\]\s*as const/);
  if (!m) throw new Error("Could not parse TOUR_FORM_PROFILE_VALUES");
  const ids = [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
  const ver = src.match(/TOUR_FORM_PROFILE_VERSION\s*=\s*(\d+)/);
  return { ids, version: ver ? Number(ver[1]) : null };
}

function readWizardModeFromWorkspaceFile(filePath) {
  const src = fs.readFileSync(filePath, "utf8");
  const m = src.match(/wizardMode:\s*"(classic|denali)"/);
  if (!m) throw new Error(`wizardMode not found in ${filePath}`);
  return m[1];
}

function parseRegistryWizardModes() {
  const registrySrc = fs.readFileSync(REGISTRY_TS, "utf8");
  const denaliMode = readWizardModeFromWorkspaceFile(DENALI_TS);
  const arcticMode = readWizardModeFromWorkspaceFile(ARCTIC_TS);
  /** @type {Record<string, string>} */
  const modes = {};
  for (const line of registrySrc.split("\n")) {
    const m = line.match(/^\s*(\w+):\s*(DENALI_WORKSPACE|ARCTIC_WORKSPACE)/);
    if (!m) continue;
    modes[m[1]] = m[2] === "DENALI_WORKSPACE" ? denaliMode : arcticMode;
  }
  return modes;
}

function expectedWizardMode(profile, registryModes) {
  return registryModes[profile] ?? "classic";
}

function main() {
  if (!fs.existsSync(FREEZE_PATH)) {
    console.error("verify-workspace-freeze: missing", FREEZE_PATH);
    process.exit(1);
  }

  const { ids: sourceIds, version } = parseTourFormProfileValues();
  const registryModes = parseRegistryWizardModes();
  const freeze = JSON.parse(fs.readFileSync(FREEZE_PATH, "utf8"));

  const frozenIds = freeze.profiles.map((p) => p.id).sort();
  const sortedSource = [...sourceIds].sort();

  if (JSON.stringify(frozenIds) !== JSON.stringify(sortedSource)) {
    console.error("verify-workspace-freeze: profile id set mismatch");
    console.error("  source:", sortedSource.join(", "));
    console.error("  freeze:", frozenIds.join(", "));
    process.exit(1);
  }

  if (freeze.TOUR_FORM_PROFILE_VERSION !== version) {
    console.error(
      `verify-workspace-freeze: version freeze=${freeze.TOUR_FORM_PROFILE_VERSION} source=${version}`,
    );
    process.exit(1);
  }

  for (const profile of sourceIds) {
    const row = freeze.profiles.find((p) => p.id === profile);
    if (!row) {
      console.error(`verify-workspace-freeze: missing row for ${profile}`);
      process.exit(1);
    }
    const mode = expectedWizardMode(profile, registryModes);
    if (row.wizardMode !== mode) {
      console.error(
        `verify-workspace-freeze: wizardMode ${profile}: freeze=${row.wizardMode} expected=${mode}`,
      );
      process.exit(1);
    }
    const usesTemplate = profile === "denali_pilot";
    if (Boolean(row.usesDenaliCanonicalTemplate) !== usesTemplate) {
      console.error(`verify-workspace-freeze: usesDenaliCanonicalTemplate ${profile}`);
      process.exit(1);
    }
  }

  freeze.verification = {
    verifiedAt: new Date().toISOString(),
    gitSha: gitShortSha(),
    profileCount: sourceIds.length,
    matchesTourFormProfileValues: true,
    matchesWorkspaceRegistryWizardMode: true,
  };
  freeze.generatedAt = freeze.verification.verifiedAt;
  freeze.source = "packages/types/src/tour-form-profile.ts";
  freeze.TOUR_FORM_PROFILE_VERSION = version;

  fs.writeFileSync(FREEZE_PATH, `${JSON.stringify(freeze, null, 2)}\n`);
  console.log(
    `verify-workspace-freeze: OK (${sourceIds.length} profiles) @ ${freeze.verification.gitSha}`,
  );
}

main();
