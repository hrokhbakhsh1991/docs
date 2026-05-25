import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CONTENT_WORKSPACE_VALUES,
  PAGE_REGISTRY,
  PageSchema,
  WorkspacePagesSchema,
  getWorkspacePages,
} from "./page.registry";

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

  it("getWorkspacePages returns parseable landing routes", () => {
    const denali = getWorkspacePages("denali");
    PageSchema.parse(denali.landing);
    assert.equal(denali.landing.route.path, "/");
    assert.equal(denali.about.route.path, "/about");
  });
});
