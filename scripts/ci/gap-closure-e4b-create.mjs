#!/usr/bin/env node
/**
 * Gap Closure E.4b-d / E.4b-d2 — disposable guest workspace create proof.
 * Always: temp-root scaffold → in-memory generate → onboard-contract (no trunk leftover).
 * Optional `--package-build`: trunk scaffold → pnpm install → filter build/test → restore lockfile.
 * @see docs/dev/saas-platform-remediation.mdoc
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { discoverManifests } from "../codegen/workspace-registry/manifest-loader.mjs";
import {
  generateApiRegistry,
  productWorkspaceManifests,
} from "../codegen/workspace-registry/domains/core-registry.mjs";
import { evaluateWorkspaceOnboardContract } from "../codegen/workspace-registry/onboard-contract.mjs";
import { scaffoldWorkspace } from "../workspace-create.mjs";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const LOCKFILE = join(REPO_ROOT, "pnpm-lock.yaml");
const CORE_CONTRACT_PATHS = [
  "packages/platform-core/package.json",
  "packages/workspace-sdk/package.json",
  "apps/api/package.json",
  "apps/api/src/http/workspace-route-registrar.ts",
];

/**
 * @param {string} rel
 */
function hashFile(rel) {
  const abs = join(REPO_ROOT, rel);
  if (!existsSync(abs)) return `missing:${rel}`;
  return createHash("sha256").update(readFileSync(abs)).digest("hex");
}

/**
 * @param {string[]} argv
 * @param {{ readonly cwd?: string; readonly env?: NodeJS.ProcessEnv }} [opts]
 */
function run(argv, opts = {}) {
  const result = spawnSync(argv[0], argv.slice(1), {
    cwd: opts.cwd ?? REPO_ROOT,
    env: opts.env ?? process.env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error(
      `command failed (${result.status}): ${argv.join(" ")}${detail ? `\n${detail}` : ""}`
    );
  }
  return result;
}

/**
 * @param {string} id
 */
function runInMemoryContractProof(id) {
  const before = Object.fromEntries(CORE_CONTRACT_PATHS.map((p) => [p, hashFile(p)]));
  const tempRoot = mkdtempSync(join(tmpdir(), "gap-closure-e4b-"));

  try {
    const { dir, pkgName } = scaffoldWorkspace({
      repoRoot: tempRoot,
      id,
      guest: true,
    });
    assert.equal(pkgName, `@app-tour/workspace-${id}`);
    assert.ok(existsSync(join(dir, "workspace.manifest.json")));
    assert.equal(existsSync(join(REPO_ROOT, "packages/workspaces", id)), false);

    const after = Object.fromEntries(CORE_CONTRACT_PATHS.map((p) => [p, hashFile(p)]));
    for (const rel of CORE_CONTRACT_PATHS) {
      assert.equal(after[rel], before[rel], `core contract must stay unchanged: ${rel}`);
    }

    const tempManifest = JSON.parse(readFileSync(join(dir, "workspace.manifest.json"), "utf8"));
    const trunk = discoverManifests();
    const union = [...trunk, tempManifest].sort((a, b) => a.id.localeCompare(b.id));
    const product = productWorkspaceManifests(union);
    const generated = generateApiRegistry(union);
    assert.match(generated, new RegExp(`case "${id}"`));
    const contract = evaluateWorkspaceOnboardContract(product, generated);
    assert.equal(
      contract.ok,
      true,
      contract.ok ? "ok" : `violations: ${contract.violations.join("; ")}`
    );

    console.log(`E.4b-d: in-memory create→generate→contract PASS (${id})`);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
    assert.equal(existsSync(join(REPO_ROOT, "packages/workspaces", id)), false);
  }
}

/**
 * Gap Closure E.4b-d2 — disposable trunk package build (lockfile restored).
 * @param {string} id
 */
function runPackageBuildProof(id) {
  const pkgDir = join(REPO_ROOT, "packages/workspaces", id);
  const pkgName = `@app-tour/workspace-${id}`;
  assert.equal(existsSync(pkgDir), false, `refusing to overwrite existing ${pkgDir}`);
  assert.ok(existsSync(LOCKFILE), "pnpm-lock.yaml required for package-build proof");

  const lockBackup = readFileSync(LOCKFILE);
  const before = Object.fromEntries(CORE_CONTRACT_PATHS.map((p) => [p, hashFile(p)]));
  let scaffolded = false;

  try {
    const { dir } = scaffoldWorkspace({
      repoRoot: REPO_ROOT,
      id,
      guest: true,
    });
    scaffolded = true;
    assert.equal(dir, pkgDir);

    console.log(`E.4b-d2: pnpm install (link ${pkgName})…`);
    run(["pnpm", "install", "--no-frozen-lockfile"]);

    console.log(`E.4b-d2: build ${pkgName}…`);
    run(["pnpm", "--filter", pkgName, "run", "build"]);

    console.log(`E.4b-d2: test ${pkgName}…`);
    run(["pnpm", "--filter", pkgName, "run", "test"]);

    const after = Object.fromEntries(CORE_CONTRACT_PATHS.map((p) => [p, hashFile(p)]));
    for (const rel of CORE_CONTRACT_PATHS) {
      assert.equal(after[rel], before[rel], `core contract must stay unchanged: ${rel}`);
    }

    console.log(`E.4b-d2: trunk package build/test PASS (${id})`);
  } finally {
    if (scaffolded || existsSync(pkgDir)) {
      rmSync(pkgDir, { recursive: true, force: true });
    }
    writeFileSync(LOCKFILE, lockBackup);
    assert.equal(existsSync(pkgDir), false, `leftover package dir after cleanup: ${pkgDir}`);
    // Do not re-run frozen install here: CI jobs are ephemeral, and a dirty local
    // checkout may already disagree with lockfile for unrelated reasons.
    console.log("E.4b-d2: restored pnpm-lock.yaml; package dir removed");
  }
}

function main(argv) {
  const args = argv.filter((a) => a !== "--");
  const packageBuild = args.includes("--package-build");
  const unknown = args.filter((a) => a.startsWith("-") && a !== "--package-build");
  if (unknown.length > 0) {
    console.error(`Unknown option: ${unknown.join(", ")}`);
    console.error("Usage: node scripts/ci/gap-closure-e4b-create.mjs [--package-build]");
    process.exit(1);
  }

  const stamp = Date.now();
  const memoryId = `acme-e4b-${stamp}`;
  console.log(`== E.4b-d disposable create (${memoryId}) ==`);
  runInMemoryContractProof(memoryId);

  if (packageBuild) {
    const buildId = `acme-e4bd-${stamp}`;
    console.log(`== E.4b-d2 disposable package build (${buildId}) ==`);
    runPackageBuildProof(buildId);
  }

  console.log(`gap-closure-e4b-create: PASS (${memoryId}${packageBuild ? ` + package-build` : ""})`);
}

try {
  main(process.argv.slice(2));
} catch (err) {
  console.error(`gap-closure-e4b-create: FAIL — ${err instanceof Error ? err.message : err}`);
  process.exit(1);
}
