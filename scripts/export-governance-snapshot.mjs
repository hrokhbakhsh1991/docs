#!/usr/bin/env node
/**
 * Phase 15.3 — export governance snapshot for drift detection.
 * Output: governance-snapshots/YYYY-MM-DD.json
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

function readRepo(relPath) {
  return fs.readFileSync(path.join(REPO_ROOT, relPath), "utf8");
}

function extractConstArray(source, constName) {
  const re = new RegExp(
    `export const ${constName}\\s*=\\s*\\[([\\s\\S]*?)\\]\\s*as const`,
    "m",
  );
  const match = source.match(re);
  if (!match) return [];
  const values = [];
  const capRe = /"([^"]+)"/g;
  let m;
  while ((m = capRe.exec(match[1])) !== null) {
    values.push(m[1]);
  }
  return values;
}

const date = new Date().toISOString().slice(0, 10);
const outDir = path.join(REPO_ROOT, "governance-snapshots");
fs.mkdirSync(outDir, { recursive: true });

const registrySrc = readRepo("packages/shared/rbac/capability-registry.ts");
const governanceSrc = readRepo("packages/shared/rbac/capability-governance.ts");
const lifecycleSrc = readRepo("packages/shared/rbac/tour-lifecycle-governance.ts");
const patchSrc = readRepo("packages/shared-contracts/src/tours/tour-patch-contract.ts");
const modulesSrc = readRepo("packages/shared/rbac/capabilities.ts");

const snapshot = {
  generatedAt: new Date().toISOString(),
  capabilityRegistry: extractConstArray(registrySrc, "WORKSPACE_CAPABILITY_VALUES"),
  capabilityGovernance: extractConstArray(governanceSrc, "CAPABILITY_GOVERNANCE_REGISTRY").length
    ? governanceSrc.match(/key:\s*"([^"]+)"/g)?.map((l) => l.replace(/.*"/, "").replace(/"$/, "")) ?? []
    : [],
  tenantModules: extractConstArray(modulesSrc, "TENANT_MODULE_IDS"),
  patchFieldMatrix: extractConstArray(patchSrc, "TOUR_PATCH_CONTRACT_RULES").length
    ? patchSrc.match(/dtoKey:\s*"([^"]+)"/g)?.map((l) => l.replace(/.*"/, "").replace(/"$/, "")) ?? []
    : [],
  lifecycleRules: lifecycleSrc.includes("TOUR_LIFECYCLE_TRANSITION_MATRIX")
    ? "tour-lifecycle-governance.ts"
    : [],
  caslGrants: "workspace-ability.factory.service.ts",
  roleMatrix: extractConstArray(readRepo("packages/shared/rbac/workspace-roles.ts"), "WORKSPACE_ROLES"),
};

const outPath = path.join(outDir, `${date}.json`);
fs.writeFileSync(outPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
console.log(`[governance-snapshot] wrote ${outPath}`);

const audit = spawnSync(process.execPath, [path.join(REPO_ROOT, "scripts", "run-tour-governance.mjs")], {
  cwd: REPO_ROOT,
  stdio: "inherit",
});
process.exit(audit.status ?? 0);
