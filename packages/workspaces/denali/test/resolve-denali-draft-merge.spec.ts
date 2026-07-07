import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveDenaliDraftMerge } from "../src/draft/resolve-denali-draft-merge";

describe("resolve-denali-draft-merge.spec.ts — P15-W-B2", () => {
  it("returns undefined when mode is on (server wins)", () => {
    assert.equal(resolveDenaliDraftMerge("on"), undefined);
  });

  it("returns merge function for shadow and off modes", () => {
    assert.equal(typeof resolveDenaliDraftMerge("shadow"), "function");
    assert.equal(typeof resolveDenaliDraftMerge("off"), "function");
  });
});
