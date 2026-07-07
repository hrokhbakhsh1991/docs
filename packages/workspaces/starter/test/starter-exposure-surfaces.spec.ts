import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { validateExposureSurface } from "@app-tour/workspace-sdk";

import { getStarterExposureSurface } from "../src/exposure/starter-exposure.surface";
import {
  mapStarterExposureSurfaceToFieldPolicySurface,
  STARTER_EXPOSURE_SURFACE,
  STARTER_PUBLIC_LIST_FIELD_IDS,
} from "../src/exposure/starter-exposure-surfaces";
import { getStarterWorkspacePlugin } from "../src/starter.plugin";

describe("starter exposure surfaces (M5)", () => {
  it("declares a public_list surface aligned with starter field policy fields", () => {
    const surface = getStarterExposureSurface();
    assert.doesNotThrow(() => validateExposureSurface(surface));
    assert.equal(surface.definitions.length, 1);
    assert.equal(surface.definitions[0]?.surface, STARTER_EXPOSURE_SURFACE.publicList);
    assert.deepEqual(surface.definitions[0]?.defaultFieldIds, STARTER_PUBLIC_LIST_FIELD_IDS);
  });

  it("maps public_list to public_website FieldPolicy surface", () => {
    assert.equal(
      mapStarterExposureSurfaceToFieldPolicySurface(STARTER_EXPOSURE_SURFACE.publicList),
      "public_website",
    );
  });

  it("wires exposureSurface on the starter workspace plugin", () => {
    const plugin = getStarterWorkspacePlugin();
    assert.ok(plugin.exposureSurface !== undefined);
    assert.equal(plugin.exposureSurface?.manifestVersion, 1);
    assert.ok(plugin.exposureSurface.definitions.length >= 1);
  });
});
