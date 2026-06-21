import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { denaliDraftTombstoneBinding } from "../src/draft/denali-draft-tombstone-binding";

describe("denali-draft-tombstone-binding", () => {
  it("photos removed from baseline → tombstone photos", () => {
    const result = denaliDraftTombstoneBinding.resolveTombstoneRoots(
      { photos: [{ id: "p1" }], title: "Tour" },
      { title: "Tour" },
    );
    assert.deepEqual(result, ["photos"]);
  });

  it("unchanged photos → no tombstones", () => {
    const form = { photos: [{ id: "p1" }] };
    assert.deepEqual(denaliDraftTombstoneBinding.resolveTombstoneRoots(form, form), []);
  });
});
