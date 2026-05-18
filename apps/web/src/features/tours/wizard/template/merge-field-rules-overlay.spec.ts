import assert from "node:assert/strict";
import test from "node:test";

import {
  getProfileRulesForWizard,
  mergeProfileRulesWithFieldOverlay,
  parseFieldRulesOverlay,
} from "./merge-field-rules-overlay";
import { getProfileRules } from "@/features/tours/wizard/profileRules/getProfileRules";

test("parseFieldRulesOverlay ignores invalid entries", () => {
  const map = parseFieldRulesOverlay({
    "overview.title": { required: "required" },
    bad: null,
    "nope.visibility": { visibility: "not-a-tier" },
  });
  assert.equal(map.size, 1);
  assert.deepEqual(map.get("overview.title"), { required: "required" });
});

test("mergeProfileRulesWithFieldOverlay patches known field paths only", () => {
  const base = getProfileRules("general");
  const overlay = parseFieldRulesOverlay({
    "overview.title": { required: "optional" },
    "unknown.path": { required: "required" },
  });
  const merged = mergeProfileRulesWithFieldOverlay(base, overlay);
  assert.equal(merged.fields.get("overview.title")?.required, "optional");
  assert.equal(base.fields.get("overview.title")?.required, "required");
});

test("getProfileRulesForWizard returns base when overlay empty", () => {
  const base = getProfileRules("mountain_outdoor");
  const withEmpty = getProfileRulesForWizard("mountain_outdoor", {});
  assert.equal(withEmpty, base);
});
