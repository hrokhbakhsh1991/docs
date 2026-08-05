import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { wizardFieldHasValidationIssue } from "../src/wizard-field-has-validation-issue.js";

describe("wizardFieldHasValidationIssue", () => {
  it("matches exact canonical paths", () => {
    assert.equal(
      wizardFieldHasValidationIssue("title", [{ path: "title", message: "required" }]),
      true
    );
    assert.equal(
      wizardFieldHasValidationIssue("title", [{ path: "destinationId", message: "required" }]),
      false
    );
  });

  it("matches nested object and array paths under the field", () => {
    assert.equal(
      wizardFieldHasValidationIssue("itinerary", [
        { path: "itinerary.days.0.title", message: "required" },
      ]),
      true
    );
    assert.equal(
      wizardFieldHasValidationIssue("photos", [{ path: "photos[0].url", message: "required" }]),
      true
    );
    assert.equal(
      wizardFieldHasValidationIssue("photo", [{ path: "photos[0].url", message: "required" }]),
      false
    );
  });

  it("returns false for empty path or empty issues", () => {
    assert.equal(wizardFieldHasValidationIssue("", [{ path: "title", message: "x" }]), false);
    assert.equal(wizardFieldHasValidationIssue("title", []), false);
  });

  it("accepts bare path strings (composite validationIssuePaths)", () => {
    assert.equal(
      wizardFieldHasValidationIssue("program.shortDescription", ["program.shortDescription"]),
      true
    );
    assert.equal(wizardFieldHasValidationIssue("program.themeIds", ["program.shortDescription"]), false);
  });
});
