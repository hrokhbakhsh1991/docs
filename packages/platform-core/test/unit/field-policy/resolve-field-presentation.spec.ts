import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  groupFieldPresentations,
  resolveFieldPresentation,
} from "../../../src/field-policy/resolve-field-presentation.js";

describe("resolveFieldPresentation", () => {
  it("prefers adminLabel over canonical path", () => {
    const presentation = resolveFieldPresentation({
      id: "denali.destination",
      canonicalPath: "destinationId",
      adminLabel: "Tour Destination",
      group: "Location",
    });

    assert.equal(presentation.label, "Tour Destination");
    assert.equal(presentation.group, "Location");
    assert.equal(presentation.id, "denali.destination");
  });

  it("humanizes canonical path when adminLabel is absent", () => {
    const presentation = resolveFieldPresentation({
      id: "startDateTime",
      canonicalPath: "startDateTime",
    });

    assert.equal(presentation.label, "Start Date Time");
    assert.equal(presentation.group, "General");
  });

  it("groups fields with stable section ordering", () => {
    const grouped = groupFieldPresentations([
      { id: "title", canonicalPath: "title", adminLabel: "Tour Title", group: "General" },
      {
        id: "denali.destination",
        canonicalPath: "destinationId",
        adminLabel: "Tour Destination",
        group: "Location",
      },
      { id: "price", canonicalPath: "pricing.basePrice", adminLabel: "Base Price", group: "Pricing" },
    ]);

    assert.deepEqual(Object.keys(grouped), ["Location", "Pricing", "General"]);
    assert.equal(grouped.Location?.[0]?.label, "Tour Destination");
  });
});
