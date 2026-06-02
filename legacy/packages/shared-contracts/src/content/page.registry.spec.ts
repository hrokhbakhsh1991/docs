import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CONTENT_WORKSPACE_VALUES,
  PAGE_REGISTRY,
  PageSchema,
  WorkspacePagesSchema,
  getWorkspacePagesByRegistryKey,
} from "./page.registry";
import {
  getWorkspacePages,
  resolveContentWorkspaceForTenant,
} from "./content-workspace.factory";

describe("page.registry", () => {
  it("PAGE_REGISTRY has landing and about for every content workspace", () => {
    for (const workspace of CONTENT_WORKSPACE_VALUES) {
      const pages = PAGE_REGISTRY[workspace];
      assert.ok(pages.landing);
      assert.ok(pages.about);
      assert.equal(pages.landing.pageKey, "landing");
      assert.equal(pages.about.pageKey, "about");
      WorkspacePagesSchema.parse(pages);
    }
  });

  it("getWorkspacePages resolves outdoor_pilot bundle from tour form profile hint", () => {
    const pages = getWorkspacePages("mountain-club", { tourFormProfile: "denali_pilot" });
    PageSchema.parse(pages.landing);
    assert.equal(pages.landing.route.path, "/");
    assert.equal(pages.about.route.path, "/about");
    assert.equal(
      resolveContentWorkspaceForTenant({
        tenantSlug: "mountain-club",
        tourFormProfile: "denali_pilot",
      }),
      "outdoor_pilot",
    );
    assert.deepEqual(pages, getWorkspacePagesByRegistryKey("outdoor_pilot"));
  });
});
