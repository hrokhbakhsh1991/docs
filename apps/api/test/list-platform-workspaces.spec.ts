import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { listPlatformWorkspaces } from "../src/platform/list-platform-workspaces.ts";

describe("listPlatformWorkspaces", () => {
  it("includes denali as certified for production onboarding", () => {
    const workspaces = listPlatformWorkspaces();
    const denali = workspaces.find((entry) => entry.id === "denali");
    assert.ok(denali);
    assert.equal(denali.productionTier, "certified");
    assert.equal(denali.productionOnboardingAllowed, true);
  });

  it("includes harbor as certified for G1 production onboarding", () => {
    const workspaces = listPlatformWorkspaces();
    const harbor = workspaces.find((entry) => entry.id === "harbor");
    assert.ok(harbor);
    assert.equal(harbor.productionTier, "certified");
    assert.equal(harbor.productionOnboardingAllowed, true);
  });

  it("marks urban and guest-club as stub", () => {
    const workspaces = listPlatformWorkspaces();
    for (const id of ["urban", "guest-club"] as const) {
      const entry = workspaces.find((item) => item.id === id);
      assert.ok(entry, id);
      assert.equal(entry.productionTier, "stub");
      assert.equal(entry.productionOnboardingAllowed, false);
    }
  });

  it("excludes starter operator scaffold", () => {
    const ids = listPlatformWorkspaces().map((entry) => entry.id);
    assert.ok(!ids.includes("starter"));
    assert.ok(ids.includes("denali"));
  });

  it("types array per workspace", () => {
    const entry = listPlatformWorkspaces()[0];
    assert.equal(Array.isArray(entry.types), true);
    assert.equal(entry.types[0], entry.id);
  });
});
