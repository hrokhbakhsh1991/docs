import assert from "node:assert/strict";
import test from "node:test";

import { mapDenaliCanonicalToFormPath } from "../rules/denaliRuleRequired";
import { denaliRuleSet, findDenaliRuleField } from "../rules/denaliRuleModel";

import {
  DENALI_FIELD_REGISTRY,
  isDenaliAsyncAssetCanonicalPath,
  denaliRegistryCanonicalToFormMap,
  getDenaliFieldRegistryByStep,
  isDenaliFieldInMatrixCell,
  listDenaliRegistryCanonicalPaths,
} from "./DenaliFieldRegistry";
import { DENALI_FIELD_DEFINITIONS } from "./denaliFieldRegistryData";

test("DENALI_FIELD_REGISTRY aligns canonical paths with denaliRuleRequired map", () => {
  const map = denaliRegistryCanonicalToFormMap();
  for (const [canonical, rhf] of Object.entries(map)) {
    assert.equal(
      mapDenaliCanonicalToFormPath(canonical),
      rhf,
      `canonical ${canonical} should map to ${rhf}`,
    );
  }
});

test("logistics registry paths exist on mountain single_day generated rule model", () => {
  const model = denaliRuleSet.mountain.single_day!;
  const logistics = getDenaliFieldRegistryByStep("denali_logistics").filter(
    (row) => row.inRuleModel !== false,
  );
  for (const row of logistics) {
    const ruleRow = findDenaliRuleField(model, row.canonicalPath);
    assert.ok(ruleRow, `missing rule-model path ${row.canonicalPath}`);
    assert.equal(ruleRow.step, "denali_logistics", row.canonicalPath);
  }
});

test("event single_day hides outdoor logistics location fields in rule model", () => {
  const model = denaliRuleSet.event.single_day!;
  assert.equal(findDenaliRuleField(model, "gatheringPoints")?.hidden, true);
  assert.ok(findDenaliRuleField(model, "transport.mode"));
});

test("getDenaliFieldRegistryByStep(denali_logistics) returns all logistics rows", () => {
  const logistics = getDenaliFieldRegistryByStep("denali_logistics");
  assert.ok(logistics.length >= 11);
  assert.ok(logistics.some((r) => r.canonicalPath === "gatheringPoints"));
});

test("photos registry entry is asyncAsset and maps to photosData.photos", () => {
  const photos = DENALI_FIELD_REGISTRY.find((r) => r.canonicalPath === "photos");
  assert.equal(photos?.fieldKind, "asyncAsset");
  assert.equal(photos?.rhfPath, "photosData.photos");
  assert.equal(photos?.weight, 10);
  assert.equal(isDenaliAsyncAssetCanonicalPath("photos"), true);
  assert.equal(isDenaliAsyncAssetCanonicalPath("gatheringPoints"), false);
});

test("matrix cell inclusion: eventVariant only on event single_day", () => {
  const def = DENALI_FIELD_DEFINITIONS.find((d) => d.canonicalPath === "eventVariant")!;
  assert.equal(isDenaliFieldInMatrixCell(def, "event:single_day"), true);
  assert.equal(isDenaliFieldInMatrixCell(def, "mountain:single_day"), false);
});

test("full registry covers basic, program, pricing, logistics, and photos steps", () => {
  const steps = new Set(DENALI_FIELD_REGISTRY.map((r) => r.stepId));
  for (const step of [
    "denali_basic",
    "denali_program",
    "denali_logistics",
    "denali_photos",
    "denali_pricing",
  ] as const) {
    assert.ok(steps.has(step), `missing step ${step}`);
  }
  assert.ok(listDenaliRegistryCanonicalPaths().length >= 50);
});
