import assert from "node:assert/strict";
import test from "node:test";

import { isDenaliStructuredTemplate } from "./denali-template-shape";

test("isDenaliStructuredTemplate: canonicalData keys", () => {
  assert.equal(
    isDenaliStructuredTemplate({
      baseProfile: "general",
      canonicalData: { category: "mountain" },
      fieldRulesOverlay: {},
    }),
    true,
  );
});

test("isDenaliStructuredTemplate: denali rail profile", () => {
  assert.equal(
    isDenaliStructuredTemplate({
      baseProfile: "urban_event",
      canonicalData: {},
      fieldRulesOverlay: {},
    }),
    true,
  );
});

test("isDenaliStructuredTemplate: classic general only", () => {
  assert.equal(
    isDenaliStructuredTemplate({
      baseProfile: "general",
      canonicalData: {},
      fieldRulesOverlay: {},
    }),
    false,
  );
});
