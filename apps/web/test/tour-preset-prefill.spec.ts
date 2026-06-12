import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyTourPresetToDraft,
  findActiveTourPreset,
  resolvePresetId,
} from "../src/tours/tour-preset-prefill-logic";

describe("tour-preset-prefill-logic — Phase 12.2b", () => {
  it("WEB-12.2b-01 applies preset name and theme when draft is empty", () => {
    assert.equal(resolvePresetId(" preset-1 "), "preset-1");
    const preset = findActiveTourPreset(
      [
        {
          id: "preset-1",
          tenantId: "t1",
          name: "Summer hike",
          description: null,
          themeId: "theme-a",
          isActive: true,
          sortOrder: 0,
          createdAt: "",
          updatedAt: "",
        },
      ],
      "preset-1"
    );
    assert.ok(preset);
    const next = applyTourPresetToDraft({ data: {} }, preset!, ["theme-a", "theme-b"]);
    assert.equal(next.data.title, "Summer hike");
    assert.deepEqual(next.data.program?.themeIds, ["theme-a"]);
  });

  it("WEB-12.2b-01 skips inactive preset and unknown theme", () => {
    const inactive = findActiveTourPreset(
      [
        {
          id: "preset-2",
          tenantId: "t1",
          name: "Hidden",
          description: null,
          themeId: "theme-x",
          isActive: false,
          sortOrder: 0,
          createdAt: "",
          updatedAt: "",
        },
      ],
      "preset-2"
    );
    assert.equal(inactive, null);

    const active = {
      id: "preset-3",
      tenantId: "t1",
      name: "Winter",
      description: null,
      themeId: "theme-off",
      isActive: true,
      sortOrder: 0,
      createdAt: "",
      updatedAt: "",
    };
    const unchanged = applyTourPresetToDraft({ data: {} }, active, ["theme-a"]);
    assert.equal(unchanged.data.program?.themeIds, undefined);
  });
});
