import assert from "node:assert/strict";

import { describe, it } from "node:test";

import { collectWorkspaceCatalogIds } from "./collect-workspace-catalog-ids";

describe("collectWorkspaceCatalogIds", () => {
  it("returns empty arrays when trip is null", () => {
    assert.deepEqual(collectWorkspaceCatalogIds(null), {
      equipmentIds: [],
      tourThemeIds: [],
      guideLanguageIds: [],
    });
  });

  it("dedupes gear required and optional into equipmentIds", () => {
    const id1 = "11111111-1111-4111-8111-111111111111";
    const id2 = "22222222-2222-4222-8222-222222222222";
    const out = collectWorkspaceCatalogIds({
      participation: {
        gearRequiredIds: [id1, id1],
        gearOptionalIds: [id2],
      },
    });
    assert.deepEqual(out.equipmentIds, [id1, id2]);
    assert.deepEqual(out.tourThemeIds, []);
    assert.deepEqual(out.guideLanguageIds, []);
  });

  it("collects tourThemeIds and guideLanguageIds", () => {
    const t = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const g = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const out = collectWorkspaceCatalogIds({
      overview: { tourThemeIds: [t] },
      logistics: { guideLanguageIds: [g] },
    });
    assert.deepEqual(out.tourThemeIds, [t]);
    assert.deepEqual(out.guideLanguageIds, [g]);
  });
});
