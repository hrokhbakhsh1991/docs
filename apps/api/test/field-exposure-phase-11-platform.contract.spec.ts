import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import { getDenaliWorkspacePlugin } from "@app-tour/workspace-denali";
import { getStarterWorkspacePlugin } from "@app-tour/workspace-starter";

const REPO_ROOT = join(process.cwd(), "..", "..");
const EXPOSURE_DOC = join(REPO_ROOT, "docs/architecture/field-exposure-system.md");
const CONTRACT_DOC = join(REPO_ROOT, "docs/dev/workspace-exposure-plugin-contract.mdoc");
const GUARD_SCRIPT = join(REPO_ROOT, "scripts/guards/field-exposure-phase-11-guard.mjs");
const SURFACES_SERVICE = join(
  REPO_ROOT,
  "apps/api/src/exposure/workspace-exposure-surfaces.service.ts",
);

describe("field exposure phase 11 platform plugin contract (M5)", () => {
  it("documents M5 governance and workspace exposure plugin contract", () => {
    const text = readFileSync(EXPOSURE_DOC, "utf8");
    assert.match(text, /## Enterprise Closure — Milestone M5 \(Platform Scale\)/);
    assert.match(text, /guard:field-exposure-phase-11/);
    const contract = readFileSync(CONTRACT_DOC, "utf8");
    assert.match(contract, /WorkspacePlugin\.exposureSurface/);
  });

  it("wires exposureSurface on denali and starter workspace plugins", () => {
    const denali = getDenaliWorkspacePlugin();
    assert.ok(denali.exposureSurface !== undefined);
    assert.ok(denali.exposureSurface.definitions.length >= 4);

    const starter = getStarterWorkspacePlugin();
    assert.ok(starter.exposureSurface !== undefined);
    assert.equal(starter.exposureSurface.definitions[0]?.surface, "public_list");
  });

  it("resolves workspace exposure surfaces via plugin port in API service", () => {
    const source = readFileSync(SURFACES_SERVICE, "utf8");
    assert.equal(source.includes("@app-tour/workspace-denali/exposure"), false);
    assert.match(source, /listOperatorVisibleExposureSurfaceDefinitions/);
    assert.match(source, /findWorkspaceExposureSurfaceDefinition/);
  });

  it("runs field-exposure-phase-11-guard successfully", () => {
    assert.ok(existsSync(GUARD_SCRIPT));
    const result = spawnSync("node", [GUARD_SCRIPT], {
      cwd: REPO_ROOT,
      encoding: "utf8",
    });
    assert.equal(
      result.status,
      0,
      result.stderr || result.stdout || "field-exposure-phase-11-guard failed",
    );
  });
});
