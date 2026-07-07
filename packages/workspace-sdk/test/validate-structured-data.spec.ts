import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { validateStructuredData } from "../src/seo/validate-structured-data";

describe("validateStructuredData", () => {
  it("SDK-SEO-01 accepts minimal TouristTrip blob", () => {
    const result = validateStructuredData({
      "@context": "https://schema.org",
      "@type": "TouristTrip",
      name: "North Ridge Trek",
    });
    assert.equal(result.ok, true);
  });

  it("SDK-SEO-02 rejects missing name", () => {
    const result = validateStructuredData({
      "@context": "https://schema.org",
      "@type": "Event",
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.errors.includes("STRUCTURED_DATA_NAME_REQUIRED"));
    }
  });
});
