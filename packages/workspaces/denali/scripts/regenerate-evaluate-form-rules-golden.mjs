#!/usr/bin/env node
/**
 * Regenerate test/fixtures/golden/evaluate-form-rules.expected.json from current rule engine.
 * Run after intentional evaluateFormRules / contextual visibility changes.
 */
import { writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { denaliWizardSteps } from "../src/layout/stepIds.ts";
import { evaluateFormRules } from "../src/rules/evaluateFormRules.ts";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const goldenDir = join(packageRoot, "test/fixtures/golden");

function loadGoldenForm(filename) {
  const raw = JSON.parse(readFileSync(join(goldenDir, filename), "utf8"));
  const { _templateOverlay: _ignored, ...form } = raw;
  return form;
}

function snapshotEvaluateFormRules(form) {
  const out = {};
  for (const step of denaliWizardSteps) {
    if (step === "review") continue;
    out[step] = evaluateFormRules(form, step);
  }
  return out;
}

const cases = [
  ["tour-minimal.json", "tour-minimal"],
  ["tour-template-overlay.json", "tour-template-overlay"],
  ["tour-publish-ready.json", "tour-publish-ready"],
];

const expected = {};
for (const [file, key] of cases) {
  expected[key] = snapshotEvaluateFormRules(loadGoldenForm(file));
}

const target = join(goldenDir, "evaluate-form-rules.expected.json");
writeFileSync(target, `${JSON.stringify(expected, null, 2)}\n`, "utf8");
console.log(`[denali-golden] wrote ${target}`);
