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

  it("extracts correlationId for operator-facing submit errors", () => {
    const parsed = parseTourApiErrorBody({
      error: "internal_error",
      correlationId: "8104fe81-3909-4563-b29f-97414e10abfa",
    });
    assert.equal(parsed.code, "unknown_error");
    assert.equal(parsed.message, "internal_error");
    assert.equal(parsed.correlationId, "8104fe81-3909-4563-b29f-97414e10abfa");
  });
});
