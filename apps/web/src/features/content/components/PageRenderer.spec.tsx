import assert from "node:assert/strict";
import test from "node:test";

import { PAGE_REGISTRY, PageBlockSchema } from "@repo/shared-contracts";

import { SUPPORTED_PAGE_BLOCK_KINDS } from "../pageBlockKinds";

test("ComponentFactory supports every kind on outdoor_pilot landing blocks", () => {
  const blocks = PAGE_REGISTRY.outdoor_pilot.landing.sections.flatMap((section) => section.blocks);
  assert.ok(blocks.length >= 2);

  for (const block of blocks) {
    PageBlockSchema.parse(block);
    assert.ok(
      SUPPORTED_PAGE_BLOCK_KINDS.includes(block.kind),
      `missing renderer for block kind ${block.kind}`,
    );
  }

  const kinds = new Set(blocks.map((block) => block.kind));
  assert.ok(kinds.has("text"));
  assert.ok(kinds.has("image"));
});

test("PAGE_REGISTRY.outdoor_pilot.landing matches PageRenderer route metadata", () => {
  const page = PAGE_REGISTRY.outdoor_pilot.landing;
  assert.equal(page.pageKey, "landing");
  assert.equal(page.route.path, "/");
  assert.ok(page.sections.some((section) => section.slug === "hero"));
});
