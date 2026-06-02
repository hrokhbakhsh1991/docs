import assert from "node:assert/strict";
import test from "node:test";

import { getDenaliSettingsOverlayFieldHints } from "./denaliOverlayFieldHints";
import { denaliRuleSet, findDenaliRuleField } from "./denaliRuleModel";
import {
  applyOverlayToRuleSet,
  parseFieldRulesOverlay,
} from "./templateOverlay";

test("applyOverlayToRuleSet preserves matrix hidden when overlay visibility is always", () => {
  const overlay = parseFieldRulesOverlay({
    "program.itinerary": { visibility: "always" },
  });
  const merged = applyOverlayToRuleSet(denaliRuleSet, overlay);

  const singleDay = merged.mountain.single_day!;
  const multiDay = merged.mountain.multi_day!;
  assert.equal(findDenaliRuleField(singleDay, "program.itinerary")?.hidden, true);
  assert.equal(findDenaliRuleField(multiDay, "program.itinerary")?.hidden, false);
});

test("applyOverlayToRuleSet still unhides when matrix default is visible", () => {
  const overlay = parseFieldRulesOverlay({
    destinationId: { visibility: "hidden" },
  });
  const merged = applyOverlayToRuleSet(denaliRuleSet, overlay);
  const model = merged.mountain.single_day!;
  assert.equal(findDenaliRuleField(model, "destinationId")?.hidden, true);
});

test("applyOverlayToRuleSet applies always when matrix default is visible", () => {
  const baseField = findDenaliRuleField(denaliRuleSet.mountain.multi_day!, "destinationId");
  assert.equal(baseField?.hidden, false);

  const overlay = parseFieldRulesOverlay({
    destinationId: { visibility: "always" },
  });
  const merged = applyOverlayToRuleSet(denaliRuleSet, overlay);
  assert.equal(findDenaliRuleField(merged.mountain.multi_day!, "destinationId")?.hidden, false);
});

test("getDenaliSettingsOverlayFieldHints includes transport.dongAmount contextual hint", () => {
  const hints = getDenaliSettingsOverlayFieldHints();
  const dongHints = hints.get("transport.dongAmount");
  assert.ok(dongHints?.some((h) => h.kind === "contextual" && h.messageKey === "transportDong"));
});

test("getDenaliSettingsOverlayFieldHints includes matrix variance for program.itinerary", () => {
  const hints = getDenaliSettingsOverlayFieldHints();
  const itineraryHints = hints.get("program.itinerary");
  assert.ok(
    itineraryHints?.some((h) => h.kind === "matrix" && h.messageKey === "variesByClassification"),
  );
});
