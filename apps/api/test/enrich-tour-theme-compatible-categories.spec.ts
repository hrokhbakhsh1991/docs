import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { enrichTourThemeCompatibleCategories } from "../src/settings/enrich-tour-theme-compatible-categories";

describe("enrich-tour-theme-compatible-categories", () => {
  it("API-P11-17-01 adds compatibleCategories from formProfile", () => {
    const enriched = enrichTourThemeCompatibleCategories({
      id: "theme-1",
      tenantId: "tenant",
      name: "Mountain",
      slug: "mountain",
      formProfile: "mountain_outdoor",
      isActive: true,
      sortOrder: 0,
      createdAt: "2026-06-11T00:00:00.000Z",
      updatedAt: "2026-06-11T00:00:00.000Z",
    });
    assert.deepEqual(enriched.compatibleCategories, ["mountain"]);
  });
});
