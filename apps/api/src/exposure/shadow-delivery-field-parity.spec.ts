import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveShadowDeliveryFieldParity } from "./shadow-delivery-field-parity";

describe("resolveShadowDeliveryFieldParity", () => {
  it("matches when shadow mirrors authoritative delivery fields", () => {
    const parity = resolveShadowDeliveryFieldParity({
      shadow: {
        candidateFieldIds: ["title", "denali.destination"],
        exposedFieldIds: ["title"],
        fieldValues: { title: "Alpine Day" },
        templateOverrideId: "New {{field:title}}",
      },
      authoritative: {
        candidateFieldIds: ["title", "denali.destination"],
        eligibleFieldIds: ["title"],
        fieldValues: { title: "Alpine Day" },
        messageTemplate: "New {{field:title}}",
      },
    });

    assert.equal(parity.matches, true);
    assert.deepEqual(parity.mismatches, []);
  });

  it("records field dimension mismatches for audit", () => {
    const parity = resolveShadowDeliveryFieldParity({
      shadow: {
        candidateFieldIds: ["title"],
        exposedFieldIds: ["title"],
        fieldValues: { title: "Alpine Day" },
      },
      authoritative: {
        candidateFieldIds: ["denali.datetime"],
        eligibleFieldIds: ["denali.datetime"],
        fieldValues: { "denali.datetime": "2026-06-28" },
        messageTemplate: null,
      },
    });

    assert.equal(parity.matches, false);
    assert.deepEqual(parity.mismatches, [
      "candidate_field_ids",
      "eligible_field_ids",
      "field_values",
    ]);
  });
});
