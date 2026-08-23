#!/usr/bin/env node
/** PROD-8 R8-01 — fail-closed immutable artifact preflight. */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

function run(args, opts = {}) {
  const r = spawnSync(args[0], args.slice(1), {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    ...opts,
  });
  return r;
}

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function fail(msg) {
  console.error(`prod8-artifact-preflight: FAIL — ${msg}`);
  process.exit(1);
}

const gitSha = run(["git", "rev-parse", "HEAD"]);
if (gitSha.status !== 0) fail("git rev-parse HEAD failed");
const sha = gitSha.stdout.trim();

const status = run(["git", "status", "--porcelain"]);
if (status.status !== 0) fail("git status failed");
const dirtyLines = status.stdout
  .split("\n")
  .map((line) => line.trimEnd())
  .filter(Boolean);
const dirty = dirtyLines.length > 0;
const requireClean = process.env.PROD8_REQUIRE_CLEAN === "1";

if (requireClean && dirty) {
  fail(`dirty worktree blocks immutable RC attestation (${dirtyLines.length} paths)`);
}

const lockPath = join(root, "pnpm-lock.yaml");
if (!existsSync(lockPath)) fail("pnpm-lock.yaml missing");

const gen = run(["pnpm", "run", "generate:workspace-registry"], { env: { ...process.env, CI: "true" } });
if (gen.status !== 0) fail("generate:workspace-registry failed");

const diff = run(["git", "diff", "--name-only", "--", "packages/workspace-sdk/src"]);
const generatedDirty = (diff.stdout || "")
  .split("\n")
  .filter((line) => line.includes(".generated."));
if (generatedDirty.length > 0) {
  fail(`generated registry drift — run generate:workspace-registry and commit: ${generatedDirty.join(", ")}`);
}

const guard = run(["node", "scripts/guards/guard-deploy-profile-plan.mjs"]);
if (guard.status !== 0) fail("guard-deploy-profile-plan failed");

const report = {
  schema_version: "prod8-artifact-preflight.1",
  task: "R8-01",
  git_sha: sha,
  checked_at: new Date().toISOString(),
  dirty_worktree: dirty,
  dirty_paths: dirtyLines,
  require_clean: requireClean,
  lockfile_sha256: sha256File(lockPath),
  generated_registry_ok: true,
  status: dirty && !requireClean ? "PASS_WITH_DIRTY_ATTESTATION" : "PASS",
  policy:
    dirty && !requireClean
      ? "machinery verified; final immutable RC attestation deferred until clean checkout"
      : "clean checkout eligible for immutable RC",
};

const outDir = join(root, ".artifacts/prod8");
import { mkdirSync, writeFileSync } from "node:fs";
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "artifact-preflight.json"), `${JSON.stringify(report, null, 2)}\n`);

console.log(
  `prod8-artifact-preflight: ${report.status} — sha=${sha.slice(0, 8)} dirty=${dirty} out=.artifacts/prod8/artifact-preflight.json`,
);
process.exit(0);
