import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  EXPOSURE_FIELD_DECORATION_PREFIX_MAX_LENGTH,
  normalizeFieldDecorations,
  parseStoredFieldDecorations,
} from "./field-decorations";

describe("normalizeFieldDecorations", () => {
  const allowed = new Set(["meetingPoint", "participants.gearItems", "pricing.basePricePerPerson"]);

  it("drops decorations for unselected or disallowed field ids", () => {
    assert.deepEqual(
      normalizeFieldDecorations(
        {
          meetingPoint: { prefix: "✅ 📍" },
          "participants.gearItems": { prefix: "✅ 🎒" },
          unknownField: { prefix: "⚠️" },
        },
        {
          allowedFieldIds: allowed,
          selectedFieldIds: ["meetingPoint"],
        },
      ),
      { meetingPoint: { prefix: "✅ 📍" } },
    );
  });

  it("trims empty prefixes", () => {
    assert.deepEqual(
      normalizeFieldDecorations(
        {
          meetingPoint: { prefix: "   " },
          "participants.gearItems": { prefix: "✅ 🎒" },
        },
        {
          allowedFieldIds: allowed,
          selectedFieldIds: ["meetingPoint", "participants.gearItems"],
        },
      ),
      { "participants.gearItems": { prefix: "✅ 🎒" } },
    );
  });

  it("preserves valid multi-emoji prefixes and caps length", () => {
    const longPrefix = "✅".repeat(EXPOSURE_FIELD_DECORATION_PREFIX_MAX_LENGTH + 4);
    assert.deepEqual(
      normalizeFieldDecorations(
        {
          meetingPoint: { prefix: "  ✅ 📍  " },
          "pricing.basePricePerPerson": { prefix: longPrefix },
        },
        {
          allowedFieldIds: allowed,
          selectedFieldIds: ["meetingPoint", "pricing.basePricePerPerson"],
        },
      ),
      {
        meetingPoint: { prefix: "✅ 📍" },
        "pricing.basePricePerPerson": {
          prefix: longPrefix.slice(0, EXPOSURE_FIELD_DECORATION_PREFIX_MAX_LENGTH),
        },
      },
    );
  });
});

describe("parseStoredFieldDecorations", () => {
  it("returns undefined for invalid or empty stored values", () => {
    assert.equal(parseStoredFieldDecorations(null), undefined);
    assert.equal(parseStoredFieldDecorations({ meetingPoint: { prefix: "  " } }), undefined);
  });

  it("parses stored decoration rows", () => {
    assert.deepEqual(parseStoredFieldDecorations({ meetingPoint: { prefix: "🔺" } }), {
      meetingPoint: { prefix: "🔺" },
    });
  });
});
