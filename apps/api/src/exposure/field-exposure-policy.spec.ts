import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { restrictFieldExposureCandidates } from "./field-exposure-policy";

describe("field exposure policy", () => {
  it("restricts candidates to the exposure catalog", () => {
    assert.deepEqual(
      restrictFieldExposureCandidates({
        allowedCatalogFieldIds: ["title", "summary"],
        candidateFieldIds: ["title", "unknown.field", "summary"],
      }),
      ["title", "summary"],
    );
  });

  it("returns an empty list when no candidates remain", () => {
    assert.deepEqual(
      restrictFieldExposureCandidates({
        allowedCatalogFieldIds: ["title"],
        candidateFieldIds: ["unknown.field"],
      }),
      [],
    );
  });
});
