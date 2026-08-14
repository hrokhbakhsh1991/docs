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

  it("WEB-12.2b-02 preset title overrides template seed value but not user text", () => {
    const preset = {
      id: "preset-4",
      tenantId: "t1",
      name: "Preset summit",
      description: null,
      themeId: "theme-a",
      isActive: true,
      sortOrder: 0,
      createdAt: "",
      updatedAt: "",
    };

    const seeded = applyTourPresetToDraft(
      { data: { title: "SMK-P9-SEED" } },
      preset,
      ["theme-a"],
      { replaceableTitleValues: ["SMK-P9-SEED", "Default title"] }
    );
    assert.equal(seeded.data.title, "Preset summit");

    const userOwned = applyTourPresetToDraft(
      { data: { title: "Operator custom title" } },
      preset,
      ["theme-a"],
      { replaceableTitleValues: ["SMK-P9-SEED", "Default title"] }
    );
    assert.equal(userOwned.data.title, "Operator custom title");
  });

  it("WEB-12.2b-03 preset title overrides template default title value", () => {
    const preset = {
      id: "preset-5",
      tenantId: "t1",
      name: "Preset glacier",
      description: null,
      themeId: null,
      isActive: true,
      sortOrder: 0,
      createdAt: "",
      updatedAt: "",
    };

    const next = applyTourPresetToDraft(
      { data: { title: "Default title" } },
      preset,
      undefined,
      { replaceableTitleValues: ["Default title"] }
    );
    assert.equal(next.data.title, "Preset glacier");
  });
});
