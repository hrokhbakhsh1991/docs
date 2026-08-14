import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { unwrapDenaliTourCanonicalDocument } from "../src/finance/unwrap-denali-tour-canonical-document.ts";

describe("unwrapDenaliTourCanonicalDocument — PR15-E envelope boundary", () => {
  it("returns flat legacy document as-is", () => {
    const doc = { pricing: { basePricePerPerson: 100 } };
    assert.equal(unwrapDenaliTourCanonicalDocument(doc), doc);
  });

  it("unwraps wizard envelope to data document", () => {
    const data = { pricing: { basePricePerPerson: 2500000 } };
    const unwrapped = unwrapDenaliTourCanonicalDocument({
      data,
      roots: {},
      schemaVersion: 1,
    });
    assert.equal(unwrapped, data);
  });

  it("rejects malformed data (null / non-object / array)", () => {
    assert.equal(unwrapDenaliTourCanonicalDocument({ data: null }), null);
    assert.equal(unwrapDenaliTourCanonicalDocument({ data: "x" }), null);
    assert.equal(unwrapDenaliTourCanonicalDocument({ data: [1] }), null);
    assert.equal(unwrapDenaliTourCanonicalDocument(null), null);
    assert.equal(unwrapDenaliTourCanonicalDocument([]), null);
  });
});
