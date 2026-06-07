import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { isWorkspacePlugin } from "@app-tour/workspace-sdk";

import { getUrbanWorkspacePlugin, URBAN_THEME_TOKENS_STYLESHEET } from "../src/index";

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = join(PACKAGE_ROOT, "../../..");
const BASELINE_YAML = join(REPO_ROOT, "reports/phase-7-genericity-baseline.yaml");
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

function gitDiffPlatformCore(baselineSha: string): string {
  return execSync(`git diff ${baselineSha} -- packages/platform-core`, {
    cwd: REPO_ROOT,
    encoding: "utf8",
  }).trim();
}

function ripgrepPlatformCore(pattern: string): string {
  try {
    return execSync(
      `rg -n ${JSON.stringify(pattern)} packages/platform-core --glob '!*.md' || true`,
      { cwd: REPO_ROOT, encoding: "utf8" }
    ).trim();
  } catch {
    return "";
  }
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
    const diff = gitDiffPlatformCore(baselineSha);
    assert.equal(
      diff,
      "",
      `platform-core changed since baseline ${baselineSha} — urban must not require core diff:\n${diff}`
    );
  });

  it("REQ-P7-008: no URBAN product branches in platform-core source", () => {
    const urbanBranchHits = ripgrepPlatformCore("workspaceType === 'urban'");
    assert.equal(
      urbanBranchHits,
      "",
      `forbidden urban branch in platform-core:\n${urbanBranchHits}`
    );

    const urbanEventHits = ripgrepPlatformCore("urban_event");
    assert.equal(
      urbanEventHits,
      "",
      `legacy urban_event must not appear in platform-core:\n${urbanEventHits}`
    );

    const urbanTokenHits = ripgrepPlatformCore("URBAN_");
    assert.equal(
      urbanTokenHits,
      "",
      `URBAN_* tokens forbidden in platform-core:\n${urbanTokenHits}`
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
