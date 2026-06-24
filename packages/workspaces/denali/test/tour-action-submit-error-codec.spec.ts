import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  encodeTourActionSubmitError,
  decodeTourActionSubmitError,
} from "@app-tour/workspace-denali/ui/logic/tour-action-submit-error-codec";

describe("tour-action-submit-error-codec.spec.ts", () => {
  it("round-trips structured submit errors", () => {
    const encoded = encodeTourActionSubmitError({
      status: 400,
      code: "VALIDATION_FAILURE",
      message: 'CANONICAL_VALIDATION_FAILED: Canonical path "title" missing',
    });
    const decoded = decodeTourActionSubmitError(encoded);
    assert.deepEqual(decoded, {
      status: 400,
      code: "VALIDATION_FAILURE",
      message: 'CANONICAL_VALIDATION_FAILED: Canonical path "title" missing',
    });
  });
});
