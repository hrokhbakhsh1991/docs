/**
 * Post-create wizard redirect (WEB-P11-6-01)
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildCreateTourSuccessRedirect } from "../src/tours/create-tour-success-redirect";

describe("create-tour-success-redirect.spec.ts", () => {
  it("WEB-P11-6-01 redirects to tours list with created query", () => {
    assert.equal(
      buildCreateTourSuccessRedirect("0ad5e8ce-baa9-49fc-9344-c18ee669e7b2"),
      "/tours?created=0ad5e8ce-baa9-49fc-9344-c18ee669e7b2"
    );
  });

  it("WEB-P11-6-02 empty tour id falls back to tours list", () => {
    assert.equal(buildCreateTourSuccessRedirect("   "), "/tours");
  });
});
