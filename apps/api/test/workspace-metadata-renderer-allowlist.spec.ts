import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertAllowedPlatformRendererId,
  isAllowedPlatformRendererId,
  PLATFORM_GENERIC_RENDERER_IDS,
  WorkspaceMetadataValidationError,
} from "@app-tour/workspace-sdk/metadata";

describe("platform generic renderer allowlist (P3-B-N-002)", () => {
  it("AL-01 isAllowedPlatformRendererId(platform.photos) === true", () => {
    assert.equal(isAllowedPlatformRendererId("platform.photos"), true);
  });

  it("AL-02 isAllowedPlatformRendererId(denali.photos) === false", () => {
    assert.equal(isAllowedPlatformRendererId("denali.photos"), false);
  });

  it("AL-03 assertAllowedPlatformRendererId(platform.unknown) throws", () => {
    assert.throws(
      () => assertAllowedPlatformRendererId("platform.unknown"),
      (error: unknown) => {
        assert.ok(error instanceof WorkspaceMetadataValidationError);
        assert.equal(error.rendererId, "platform.unknown");
        assert.match(error.message, /WORKSPACE_METADATA_RENDERER_NOT_ALLOWED:platform\.unknown/);
        return true;
      }
    );
  });

  it("AL-04 PLATFORM_GENERIC_RENDERER_IDS length === 3", () => {
    assert.equal(PLATFORM_GENERIC_RENDERER_IDS.length, 3);
    assert.deepEqual([...PLATFORM_GENERIC_RENDERER_IDS], [
      "platform.photos",
      "platform.location",
      "platform.itinerary",
    ]);
  });
});
