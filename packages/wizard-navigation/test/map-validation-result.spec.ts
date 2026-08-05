/**
 * Phase 2 — mapValidationResultToIssues forwards violation codes
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  dedupeValidationViolations,
  mapValidationResultToIssues,
} from "../src/map-validation-result.js";

describe("map-validation-result.spec.ts — Phase 2", () => {
  it("forwards violation code onto ValidationIssue", () => {
    const issues = mapValidationResultToIssues({
      ok: false,
      violations: [
        {
          code: "REQUIRED_FIELD_EMPTY",
          fieldId: "title",
          message: 'Required text at "title" is empty',
        },
      ],
    });
    assert.equal(issues.length, 1);
    assert.equal(issues[0]?.code, "REQUIRED_FIELD_EMPTY");
    assert.equal(issues[0]?.path, "title");
  });

  it("dedupeValidationViolations keeps first fieldId+code", () => {
    const deduped = dedupeValidationViolations([
      {
        code: "REQUIRED_FIELD_EMPTY",
        fieldId: "pricing.basePricePerPerson",
        message: "from canonical",
      },
      {
        code: "VALIDATION_RULE_REQUIRED_FIELD",
        fieldId: "pricing.basePricePerPerson",
        message: "different code kept",
      },
      {
        code: "REQUIRED_FIELD_EMPTY",
        fieldId: "pricing.basePricePerPerson",
        message: "from readiness duplicate",
      },
    ]);
    assert.equal(deduped.length, 2);
    assert.equal(deduped[0]?.message, "from canonical");
    assert.equal(deduped[1]?.code, "VALIDATION_RULE_REQUIRED_FIELD");
  });
});
