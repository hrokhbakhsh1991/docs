import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, execSync, spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { isWorkspacePlugin } from "@app-tour/workspace-sdk";

import { getUrbanWorkspacePlugin, URBAN_THEME_TOKENS_STYLESHEET } from "../src/index";

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = join(PACKAGE_ROOT, "../../..");
const BASELINE_YAML = join(REPO_ROOT, "reports/phase-7-genericity-baseline.yaml");
const PLATFORM_CORE = join(REPO_ROOT, "packages/platform-core");

/** Bump when REQ-P7-007 proof algorithm changes (CI triage — synced with verify script). */
const PHASE_7_GENERICITY_PROOF_REV = 5;

/** Ephemeral dirs — never part of genericity baseline (see .gitignore coverage/). */
const PLATFORM_CORE_SKIP_DIRS = new Set(["node_modules", "dist", "coverage"]);

function isEphemeralPlatformCorePath(relPath: string): boolean {
  const top = relPath.split("/")[0];
  return top != null && PLATFORM_CORE_SKIP_DIRS.has(top);
}

function normalizePlatformCoreFingerprint(files: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(files).filter(([relPath]) => !isEphemeralPlatformCorePath(relPath))
  );
}

function digestPlatformCoreTree(files: Record<string, string>): string {
  const normalized = normalizePlatformCoreFingerprint(files);
  const lines = Object.keys(normalized)
    .sort()
    .map((relPath) => `${relPath}\t${normalized[relPath]}`);
  return createHash("sha256").update(lines.join("\n")).digest("hex");
}

function readBaselineYaml(): string {
  return readFileSync(BASELINE_YAML, "utf8");
}

function readBaselineSha(): string {
  const match = /baseline_sha:\s*["']?([0-9a-f]{7,40})["']?/i.exec(readBaselineYaml());
  if (!match?.[1]) {
    throw new Error(
      "phase-7-genericity-baseline.yaml missing baseline_sha — run P7-2-A01 before 7.2 closure"
    );
  }
  return match[1];
}

function readBaselineTreeDigest(): string {
  const match = /platform_core_tree_digest:\s*([0-9a-f]{64})/i.exec(readBaselineYaml());
  if (!match?.[1]) {
    throw new Error(
      "phase-7-genericity-baseline.yaml missing platform_core_tree_digest — run P7-2-A01"
    );
  }
  return match[1];
}

function baselineRefExists(baselineSha: string): boolean {
  const result = spawnSync("git", ["rev-parse", "--verify", `${baselineSha}^{commit}`], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  return result.status === 0;
}

function gitDiffPlatformCore(baselineSha: string): string {
  return execSync(`git diff ${baselineSha} -- packages/platform-core`, {
    cwd: REPO_ROOT,
    encoding: "utf8",
  }).trim();
}

function fingerprintCommittedPlatformCoreHead(): Record<string, string> {
  const listed = execFileSync(
    "git",
    ["ls-tree", "-r", "--name-only", "HEAD", "packages/platform-core"],
    { cwd: REPO_ROOT, encoding: "utf8" }
  )
    .split("\n")
    .map((path) => path.trim())
    .filter(
      (path) =>
        path.length > 0 &&
        !path.endsWith(".md") &&
        !path.split("/").some((segment) => PLATFORM_CORE_SKIP_DIRS.has(segment))
    );

  return Object.fromEntries(
    listed.map((repoPath) => [
      repoPath.slice("packages/platform-core/".length),
      createHash("sha256")
        .update(execFileSync("git", ["show", `HEAD:${repoPath}`], { cwd: REPO_ROOT }))
        .digest("hex"),
    ])
  );
}

function reportPlatformCoreDirtyWorktree(): void {
  const status = execFileSync(
    "git",
    ["status", "--short", "--untracked-files=all", "--", "packages/platform-core"],
    { cwd: REPO_ROOT, encoding: "utf8" }
  ).trim();
  if (status.length > 0) {
    console.warn(
      `REQ-P7-007 dirty-work drift (committed HEAD remains canonical):\n${status}`
    );
  }
}

function assertPlatformCoreMatchesTreeDigest(): void {
  const expectedDigest = readBaselineTreeDigest();
  const committedHeadDigest = digestPlatformCoreTree(fingerprintCommittedPlatformCoreHead());
  reportPlatformCoreDirtyWorktree();
  assert.equal(
    committedHeadDigest,
    expectedDigest,
    `committed HEAD platform-core tree digest drift since 7.2 baseline (proof rev ${PHASE_7_GENERICITY_PROOF_REV}) — urban must not touch core`
  );
}

function assertPlatformCoreUnchangedSinceBaseline(baselineSha: string): void {
  if (baselineRefExists(baselineSha)) {
    const diff = gitDiffPlatformCore(baselineSha);
    assert.equal(
      diff,
      "",
      `platform-core changed since baseline ${baselineSha} — urban must not require core diff:\n${diff}`
    );
    return;
  }
  assertPlatformCoreMatchesTreeDigest();
}

function listPlatformCoreSourceFiles(dir = PLATFORM_CORE, out: string[] = []): string[] {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, ent.name);
    if (ent.isDirectory()) {
      if (PLATFORM_CORE_SKIP_DIRS.has(ent.name)) continue;
      listPlatformCoreSourceFiles(path, out);
    } else if (!ent.name.endsWith(".md")) {
      out.push(path);
    }
  }
  return out;
}

function searchPlatformCore(pattern: RegExp): string[] {
  const hits: string[] = [];
  for (const file of listPlatformCoreSourceFiles()) {
    const lines = readFileSync(file, "utf8").split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (pattern.test(lines[i]!)) {
        const rel = relative(REPO_ROOT, file).replace(/\\/g, "/");
        hits.push(`${rel}:${i + 1}:${lines[i]}`);
      }
    }
  }
  return hits;
}

describe("phase-7.contract.spec.ts (REQ-P7-006, REQ-P7-007, REQ-P7-008)", () => {
  it("urban plugin satisfies WorkspacePlugin contract (DEC-P7-007)", () => {
    const plugin = getUrbanWorkspacePlugin();
    assert.equal(plugin.id, "urban");
    assert.equal(plugin.supportedWorkspaceTypes[0], "urban");
    assert.equal(isWorkspacePlugin(plugin), true);
    const cssPath = join(PACKAGE_ROOT, URBAN_THEME_TOKENS_STYLESHEET);
    assert.ok(readFileSync(cssPath, "utf8").includes("--ws-color-accent"));
  });

  it("REQ-P7-007: platform-core diff empty vs recorded baseline", () => {
    const baselineSha = readBaselineSha();
    assertPlatformCoreUnchangedSinceBaseline(baselineSha);
  });

  it("REQ-P7-008: no URBAN product branches in platform-core source", () => {
    const urbanBranchHits = searchPlatformCore(/workspaceType\s*===\s*['"]urban['"]/);
    assert.deepEqual(
      urbanBranchHits,
      [],
      `forbidden urban branch in platform-core:\n${urbanBranchHits.join("\n")}`
    );

    const urbanEventHits = searchPlatformCore(/urban_event/);
    assert.deepEqual(
      urbanEventHits,
      [],
      `legacy urban_event must not appear in platform-core:\n${urbanEventHits.join("\n")}`
    );

    const urbanTokenHits = searchPlatformCore(/URBAN_/);
    assert.deepEqual(
      urbanTokenHits,
      [],
      `URBAN_* tokens forbidden in platform-core:\n${urbanTokenHits.join("\n")}`
    );
  });

  it("DEC-P7-001: urban package does not depend on workspace-denali", () => {
    const pkg = JSON.parse(readFileSync(join(PACKAGE_ROOT, "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    assert.equal("@app-tour/workspace-denali" in deps, false);
  });
});
