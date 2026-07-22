/**
 * P4-D2 — unit tests for cold-path fan-in analyzer.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  analyzeProductFanIn,
  isProductWorkspaceSpecifier,
  stripComments,
} from "../guards/lib/p4-cold-path-fan-in.mjs";

const PACKAGES = Object.freeze([
  "@app-tour/workspace-denali",
  "@app-tour/workspace-starter",
]);

describe("p4-cold-path-fan-in", () => {
  it("detects product package and subpath", () => {
    assert.equal(isProductWorkspaceSpecifier("@app-tour/workspace-denali", PACKAGES), true);
    assert.equal(
      isProductWorkspaceSpecifier("@app-tour/workspace-denali/plugin", PACKAGES),
      true
    );
    assert.equal(isProductWorkspaceSpecifier("@app-tour/workspace-sdk", PACKAGES), false);
  });

  it("allows import type; flags value static import", () => {
    const src = `
import type { WorkspacePlugin } from "@app-tour/workspace-sdk";
import { getDenaliWorkspacePlugin } from "@app-tour/workspace-denali/plugin";
export async function load() {
  const mod = await import("@app-tour/workspace-starter");
  return mod;
}
`;
    const r = analyzeProductFanIn(src, PACKAGES);
    assert.deepEqual(r.staticProductImports, ["@app-tour/workspace-denali/plugin"]);
    assert.deepEqual(r.dynamicProductImports, ["@app-tour/workspace-starter"]);
    assert.equal(r.typeOnlyProductImports.length, 0);
  });

  it("ignores comments containing fake imports", () => {
    const raw = `
/* import { x } from "@app-tour/workspace-denali"; */
// import { y } from "@app-tour/workspace-starter";
const mod = await import("@app-tour/workspace-denali/plugin");
`;
    const r = analyzeProductFanIn(raw, PACKAGES);
    assert.equal(r.staticProductImports.length, 0);
    assert.deepEqual(r.dynamicProductImports, ["@app-tour/workspace-denali/plugin"]);
    assert.match(stripComments(raw), /await import/);
  });
});
