import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildDenaliRelativeTimeTrigger,
  DENALI_EXPOSURE_SURFACE,
  DENALI_OPERATOR_SETTINGS_SURFACE_DISPLAY_ORDER,
  DENALI_PUBLIC_DETAILS_FIELD_IDS,
  DENALI_PUBLIC_LIST_FIELD_IDS,
  resolveDenaliExposureCoordinate,
  resolveDenaliSurfaceDefaultFieldIds,
  sortDenaliOperatorSettingsSurfaces,
} from "../src/exposure/denali-exposure-surfaces";

describe("denali exposure surfaces", () => {
  it("defines conservative public list and details defaults", () => {
    assert.ok(DENALI_PUBLIC_LIST_FIELD_IDS.length > 0);
    assert.ok(DENALI_PUBLIC_DETAILS_FIELD_IDS.length > DENALI_PUBLIC_LIST_FIELD_IDS.length);
    for (const fieldId of DENALI_PUBLIC_LIST_FIELD_IDS) {
      assert.ok(DENALI_PUBLIC_DETAILS_FIELD_IDS.includes(fieldId));
    }
  });

  it("resolves coordinates for public and reminder surfaces", () => {
    assert.deepEqual(resolveDenaliExposureCoordinate({ surface: DENALI_EXPOSURE_SURFACE.publicList }), {
      surface: "public_list",
      audience: "public",
      trigger: { kind: "always" },
    });
    assert.deepEqual(
      resolveDenaliExposureCoordinate({
        surface: DENALI_EXPOSURE_SURFACE.reminderFeed,
        reminderOffset: "-24h",
      }),
      {
        surface: "reminder_feed",
        audience: "registered_user",
        trigger: buildDenaliRelativeTimeTrigger("-24h"),
      },
    );
  });

  it("returns surface-specific default field ids", () => {
    const listIds = resolveDenaliSurfaceDefaultFieldIds({
      surface: "public_list",
      audience: "public",
      trigger: { kind: "always" },
    });
    assert.deepEqual(listIds, DENALI_PUBLIC_LIST_FIELD_IDS);
  });

  it("orders operator settings surfaces without telegram", () => {
    assert.deepEqual(
      [...DENALI_OPERATOR_SETTINGS_SURFACE_DISPLAY_ORDER],
      ["public_list", "public_details", "user_dashboard", "reminder_feed"]
    );
    assert.ok(!DENALI_OPERATOR_SETTINGS_SURFACE_DISPLAY_ORDER.includes(DENALI_EXPOSURE_SURFACE.telegram));
    const sorted = sortDenaliOperatorSettingsSurfaces([
      { surface: "reminder_feed" },
      { surface: "unknown_surface" },
      { surface: "public_list" },
      { surface: "public_details" },
    ]);
    assert.deepEqual(
      sorted.map((row) => row.surface),
      ["public_list", "public_details", "reminder_feed", "unknown_surface"]
    );
  });
});
