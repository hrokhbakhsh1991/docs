#!/usr/bin/env node
/** PROD-6 R6-18/R6-19 — SBOM checksum and SHA-tied release evidence draft. */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const outDir = join(root, ".artifacts/prod6");
const sbomPath = join(outDir, "app-tour.cdx.json");
const evidencePath = join(outDir, "release-evidence.json");
function run(args) {
  const r = spawnSync(args[0], args.slice(1), { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(r.stderr || r.stdout || `${args.join(" ")} failed`);
  return r.stdout.trim();
}
function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}
mkdirSync(outDir, { recursive: true });
const gitSha = run(["git", "rev-parse", "HEAD"]);
const status = run(["git", "status", "--short"]);
run([process.execPath, join(root, "scripts/ops/sbom-from-pnpm-lock.mjs"), "--out", sbomPath]);
const evidence = {
  schema_version: "prod6-release-evidence.1",
  git_sha: gitSha,
  generated_at: new Date().toISOString(),
  dirty_worktree: status.length > 0,
  dirty_attestation_policy: status.length > 0 ? "final provenance attestation blocked until clean release artifact exists" : "clean",
  artifacts: {
    lockfile: { path: "pnpm-lock.yaml", sha256: sha256(join(root, "pnpm-lock.yaml")) },
    package_manifest: { path: "package.json", sha256: sha256(join(root, "package.json")) },
    sbom: { path: ".artifacts/prod6/app-tour.cdx.json", sha256: sha256(sbomPath) },
  },
  provenance: {
    local_checksum_provenance: true,
    signed_attestation: false,
    signed_attestation_blocker: status.length > 0 ? "dirty worktree; do not attest as clean RC" : "external signing not configured in local session",
  },
};
writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
console.log(`prod6-release-evidence: PASS — sha=${gitSha.slice(0, 8)} dirty=${evidence.dirty_worktree} out=.artifacts/prod6/release-evidence.json`);
