import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { enrichSettingsModuleList } from "../src/settings/workspace-settings-enrichers.generated";

describe("enrich-tour-theme-compatible-categories", () => {
  it("API-P11-17-01 adds compatibleCategories from formProfile", () => {
    const enriched = enrichSettingsModuleList("denali", "tour_themes", [
      {
        id: "theme-1",
        tenantId: "tenant",
        name: "Mountain",
        slug: "mountain",
        formProfile: "mountain_outdoor",
        isActive: true,
        sortOrder: 0,
        createdAt: "2026-06-11T00:00:00.000Z",
        updatedAt: "2026-06-11T00:00:00.000Z",
      },
    ])[0]!;
    assert.deepEqual(enriched.compatibleCategories, ["mountain"]);
  });
});
