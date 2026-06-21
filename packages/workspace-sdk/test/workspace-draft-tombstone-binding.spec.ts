import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isNonEmptyRootValue,
  topLevelRootsRemoved,
} from "../src/draft/workspace-draft-tombstone-binding";

const ROOTS = new Set(["photos", "program"]);

describe("workspace-draft-tombstone-binding", () => {
  it("topLevelRootsRemoved — baseline photos non-empty, incoming omits photos", () => {
    const result = topLevelRootsRemoved(
      { photos: [{ id: "p1" }] },
      { program: { themeIds: [] } },
      ROOTS,
    );
    assert.deepEqual(result, ["photos"]);
  });

  it("topLevelRootsRemoved — same roots unchanged returns empty", () => {
    const form = { photos: [{ id: "p1" }], program: {} };
    assert.deepEqual(topLevelRootsRemoved(form, form, ROOTS), []);
  });

  it("topLevelRootsRemoved — empty array at key does not tombstone (key still present)", () => {
    const result = topLevelRootsRemoved(
      { photos: [{ id: "p1" }] },
      { photos: [] },
      ROOTS,
    );
    assert.deepEqual(result, []);
  });

  it("isNonEmptyRootValue — empty array and empty object are empty", () => {
    assert.equal(isNonEmptyRootValue([]), false);
    assert.equal(isNonEmptyRootValue({}), false);
    assert.equal(isNonEmptyRootValue([1]), true);
  });
});
