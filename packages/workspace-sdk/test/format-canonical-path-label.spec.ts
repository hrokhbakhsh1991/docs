/**
 * Wave F.a — platform formatter unit smoke.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatCanonicalPathToLabel } from "../src/labels/format-canonical-path-label.js";

describe("formatCanonicalPathToLabel (Wave F.a)", () => {
  it("formats last path segment with spaces", () => {
    assert.equal(formatCanonicalPathToLabel("tour.title"), "Title");
    assert.equal(formatCanonicalPathToLabel("tripDetails.elevationGain"), "Elevation Gain");
    assert.equal(formatCanonicalPathToLabel("some_snake"), "Some Snake");
  });
});
