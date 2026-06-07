import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execSync, spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { isWorkspacePlugin } from "@app-tour/workspace-sdk";

import { getUrbanWorkspacePlugin, URBAN_THEME_TOKENS_STYLESHEET } from "../src/index";

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = join(PACKAGE_ROOT, "../../..");
const BASELINE_YAML = join(REPO_ROOT, "reports/phase-7-genericity-baseline.yaml");
const FINGERPRINT_JSON = join(REPO_ROOT, "reports/phase-7-platform-core-fingerprint.json");
const PLATFORM_CORE = join(REPO_ROOT, "packages/platform-core");

function readBaselineSha(): string {
  const yaml = readFileSync(BASELINE_YAML, "utf8");
  const match = /baseline_sha:\s*["']?([0-9a-f]{7,40})["']?/i.exec(yaml);
  if (!match?.[1]) {
    throw new Error(
      "phase-7-genericity-baseline.yaml missing baseline_sha — run P7-2-A01 before 7.2 closure"
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

function hashFile(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function fingerprintPlatformCore(): Record<string, string> {
  const files: Record<string, string> = {};
  const walk = (dir: string): void => {
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, ent.name);
      if (ent.isDirectory()) {
        if (ent.name === "node_modules" || ent.name === "dist") continue;
        walk(path);
        continue;
      }
      if (ent.name.endsWith(".md")) continue;
      const rel = relative(PLATFORM_CORE, path).replace(/\\/g, "/");
      files[rel] = hashFile(path);
    }
  };
  walk(PLATFORM_CORE);
  return files;
}

function assertPlatformCoreMatchesFingerprint(baselineSha: string): void {
  const manifest = JSON.parse(readFileSync(FINGERPRINT_JSON, "utf8")) as {
    baseline_sha?: string;
    files: Record<string, string>;
  };
  if (manifest.baseline_sha && manifest.baseline_sha !== baselineSha) {
    throw new Error(
      `phase-7-platform-core-fingerprint.json baseline_sha (${manifest.baseline_sha}) != ${baselineSha}`
    );
  }
  const current = fingerprintPlatformCore();
  const expected = manifest.files;
  const expectedKeys = Object.keys(expected).sort();
  const currentKeys = Object.keys(current).sort();
  assert.deepEqual(
    currentKeys,
    expectedKeys,
    "platform-core file set changed since 7.2 fingerprint — urban must not touch core"
  );
  const drift: string[] = [];
  for (const key of expectedKeys) {
    if (current[key] !== expected[key]) {
      drift.push(key);
    }
  }
  assert.equal(
    drift.length,
    0,
    `platform-core content drift since 7.2 fingerprint:\n${drift.join("\n")}`
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
  assertPlatformCoreMatchesFingerprint(baselineSha);
}

function listPlatformCoreSourceFiles(dir = PLATFORM_CORE, out: string[] = []): string[] {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "node_modules" || ent.name === "dist") continue;
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
