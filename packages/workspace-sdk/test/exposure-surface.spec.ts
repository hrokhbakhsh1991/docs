import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  validateExposureSurface,
  type WorkspaceExposureSurface,
} from "../src/exposure/workspace-exposure-surface";

describe("validateExposureSurface", () => {
  const validSurface = Object.freeze({
    manifestVersion: 1 as const,
    definitions: Object.freeze([
      Object.freeze({
        surface: "public_list",
        audience: "public",
        triggerLabel: "always",
        triggerStorageKey: "always",
        defaultFieldIds: Object.freeze(["basics.title", "details.summary"]),
      }),
    ]),
  }) satisfies WorkspaceExposureSurface;

  it("accepts a minimal valid manifest", () => {
    assert.doesNotThrow(() => validateExposureSurface(validSurface));
  });

  it("rejects duplicate surface ids", () => {
    assert.throws(
      () =>
        validateExposureSurface({
          manifestVersion: 1,
          definitions: [
            validSurface.definitions[0]!,
            { ...validSurface.definitions[0]!, audience: "registered_user" },
          ],
        }),
      /EXPOSURE_SURFACE_DUPLICATE_SURFACE:public_list/,
    );
  });

  it("rejects empty default field ids", () => {
    assert.throws(
      () =>
        validateExposureSurface({
          manifestVersion: 1,
          definitions: [{ ...validSurface.definitions[0]!, defaultFieldIds: [] }],
        }),
      /EXPOSURE_SURFACE_EMPTY_FIELD_IDS/,
    );
  });
});
