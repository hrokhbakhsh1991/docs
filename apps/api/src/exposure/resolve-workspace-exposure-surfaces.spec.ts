import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getDenaliWorkspacePlugin } from "@app-tour/workspace-denali";
import { getStarterWorkspacePlugin } from "@app-tour/workspace-starter";

import {
  findWorkspaceExposureSurfaceDefinition,
  listOperatorVisibleExposureSurfaceDefinitions,
  workspaceSupportsExposureSurfaces,
} from "./resolve-workspace-exposure-surfaces";

describe("resolve-workspace-exposure-surfaces", () => {
  it("lists operator-visible denali surfaces from plugin manifest", () => {
    const plugin = getDenaliWorkspacePlugin();
    const visible = listOperatorVisibleExposureSurfaceDefinitions("denali");
    assert.ok(visible.length >= 4);
    assert.equal(
      visible.some((entry) => entry.surface === "telegram"),
      false,
      "telegram surface must be hidden from operator settings panel",
    );
    assert.equal(visible.length, plugin.exposureSurface?.definitions.filter(
      (entry) => entry.operatorSettingsVisible !== false,
    ).length);
  });

  it("lists starter public_list surface from plugin manifest", () => {
    const surfaces = listOperatorVisibleExposureSurfaceDefinitions("starter");
    assert.equal(surfaces.length, 1);
    assert.equal(surfaces[0]?.surface, "public_list");
    assert.deepEqual(surfaces[0]?.defaultFieldIds, ["basics.title", "details.summary"]);
  });

  it("finds surface definition by id", () => {
    const publicList = findWorkspaceExposureSurfaceDefinition("denali", "public_list");
    assert.ok(publicList !== null);
    assert.equal(publicList?.triggerStorageKey, "always");

    assert.equal(findWorkspaceExposureSurfaceDefinition("urban", "public_list"), null);
  });

  it("detects workspace exposure support", () => {
    assert.equal(workspaceSupportsExposureSurfaces("denali"), true);
    assert.equal(workspaceSupportsExposureSurfaces("starter"), true);
    assert.equal(workspaceSupportsExposureSurfaces("urban"), false);
  });
});
