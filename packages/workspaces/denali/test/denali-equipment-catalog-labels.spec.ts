import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  resolveEquipmentCatalogSearchText,
  resolveEquipmentCatalogSubtitle,
  resolveEquipmentThemeNames,
  resolveTourCategoryLabelKey,
} from "../src/ui/logic/denali-equipment-catalog-labels";

describe("denali-equipment-catalog-labels.spec.ts", () => {
  it("DENALI-GEAR-LABEL-01 resolves theme names from catalog ids", () => {
    const themesById = new Map([
      ["t1", { name: "کوهستان" }],
      ["t2", { name: "طبیعت" }],
    ]);
    assert.deepEqual(resolveEquipmentThemeNames(["t1", "missing", "t2"], themesById), [
      "کوهستان",
      "طبیعت",
    ]);
  });

  it("DENALI-GEAR-LABEL-02 search text includes theme names", () => {
    const themesById = new Map([["t1", { name: "Winter hike" }]]);
    assert.equal(
      resolveEquipmentCatalogSearchText(
        {
          id: "e1",
          name: "Poles",
          category: "mountain",
          themeIds: ["t1"],
          sortOrder: 0,
        },
        resolveEquipmentThemeNames(["t1"], themesById)
      ),
      "Poles mountain Winter hike"
    );
  });

  it("DENALI-GEAR-LABEL-03 maps category slug to tourKind message key", () => {
    assert.equal(resolveTourCategoryLabelKey("mountain"), "composites.tourKind.categories.mountain");
  });

  it("DENALI-GEAR-LABEL-04 prefers linked theme names over raw category slug (settings parity)", () => {
    const themesById = new Map([["t1", { name: "تم کوهستان" }]]);
    const subtitle = resolveEquipmentCatalogSubtitle(
      {
        id: "e1",
        name: "عصا",
        category: "mountain",
        themeIds: ["t1"],
        sortOrder: 0,
      },
      themesById,
      {
        formatThemeNames: (names) => names.join("، "),
        resolveCategoryLabel: () => "کوهنوردی",
        allThemesLabel: "همه تم‌ها",
      }
    );
    assert.equal(subtitle, "تم کوهستان");
    assert.notEqual(subtitle, "mountain");
  });

  it("DENALI-GEAR-LABEL-05 falls back to localized category when themeIds are empty", () => {
    const subtitle = resolveEquipmentCatalogSubtitle(
      {
        id: "e1",
        name: "عصا",
        category: "mountain",
        themeIds: [],
        sortOrder: 0,
      },
      new Map(),
      {
        formatThemeNames: (names) => names.join(", "),
        resolveCategoryLabel: () => "کوهنوردی",
        allThemesLabel: "همه تم‌ها",
      }
    );
    assert.equal(subtitle, "کوهنوردی");
  });

  it("DENALI-GEAR-LABEL-06 uses all-themes copy when no theme link and no category", () => {
    const subtitle = resolveEquipmentCatalogSubtitle(
      {
        id: "e1",
        name: "عصا",
        category: null,
        themeIds: [],
        sortOrder: 0,
      },
      new Map(),
      {
        formatThemeNames: () => "",
        resolveCategoryLabel: () => null,
        allThemesLabel: "همه تم‌ها",
      }
    );
    assert.equal(subtitle, "همه تم‌ها");
  });
});
