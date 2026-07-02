import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  URBAN_EXPOSURE_SURFACE,
  URBAN_EXPOSURE_SURFACE_DEFINITIONS,
  mapUrbanExposureSurfaceToFieldPolicySurface,
} from "../src/exposure";
import { getUrbanWorkspacePlugin } from "../src/urban.plugin";

describe("urban exposure surfaces", () => {
  it("declares public_list and public_details with catalog field defaults", () => {
    const surfaces = URBAN_EXPOSURE_SURFACE_DEFINITIONS.map((entry) => entry.surface);
    assert.deepEqual(surfaces, [
      URBAN_EXPOSURE_SURFACE.publicList,
      URBAN_EXPOSURE_SURFACE.publicDetails,
    ]);
  });

  it("maps public catalog surfaces to public_website FieldPolicy surface", () => {
    assert.equal(mapUrbanExposureSurfaceToFieldPolicySurface("public_list"), "public_website");
    assert.equal(mapUrbanExposureSurfaceToFieldPolicySurface("public_details"), "public_website");
  });

  it("wires exposureSurface on the urban workspace plugin", () => {
    const plugin = getUrbanWorkspacePlugin();
    assert.ok(plugin.exposureSurface !== undefined);
    assert.equal(plugin.exposureSurface?.manifestVersion, 1);
    assert.equal(plugin.exposureSurface?.definitions.length, 2);
  });
});
