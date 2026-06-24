import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseTourApiErrorBody } from "../src/tours/parse-tour-api-error-body";

describe("parse-tour-api-error-body.spec.ts", () => {
  it("uses API code field and error message separately", () => {
    const parsed = parseTourApiErrorBody({
      code: "VALIDATION_FAILURE",
      error:
        'CANONICAL_VALIDATION_FAILED: Canonical path "startPoint" expects kind "text" but got object',
    });
    assert.equal(parsed.code, "VALIDATION_FAILURE");
    assert.match(parsed.message, /startPoint/);
  });

  it("infers CANONICAL_VALIDATION_FAILED when code is absent", () => {
    const parsed = parseTourApiErrorBody({
      error: "CANONICAL_VALIDATION_FAILED: title required",
    });
    assert.equal(parsed.code, "CANONICAL_VALIDATION_FAILED");
    assert.equal(parsed.message, "CANONICAL_VALIDATION_FAILED: title required");
  });
});
