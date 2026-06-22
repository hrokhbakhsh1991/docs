/**
 * P5-B-N-013 — client/server evaluateFormRules parity (RP-05)
 * @see docs/phase-18/platform-denali-operator-parity.mdoc
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { buildDenaliWorkspaceRuleSet } from "../src/denali-plugin-adapter";
import { denaliWizardSteps } from "../src/layout/stepIds";
import type { DenaliCreateTourWizardForm } from "../src/schemas/denaliCore.schema";
import { evaluateFormRules, type EvaluatedFormFieldRule } from "../src/rules/evaluateFormRules";
import { denaliRuleSet } from "../src/rules/denaliRuleModel";
import type { WorkspaceRuleSet } from "@app-tour/workspace-sdk";
import { getDenaliWorkspacePlugin } from "../src/denali.plugin";

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const GOLDEN_DIR = join(PACKAGE_ROOT, "test/fixtures/golden");
const DENALI_V1_SEED = join(
  PACKAGE_ROOT,
  "../../../apps/api/scripts/seed/definitions/denali-v1.json"
);

function loadGoldenForm(filename: string): DenaliCreateTourWizardForm {
  const raw = JSON.parse(readFileSync(join(GOLDEN_DIR, filename), "utf8")) as Record<
    string,
    unknown
  >;
  const { _templateOverlay: _ignored, ...form } = raw;
  return form as DenaliCreateTourWizardForm;
}

function loadMetadataWorkspaceRuleSetFromSeed(): WorkspaceRuleSet {
  const seed = JSON.parse(readFileSync(DENALI_V1_SEED, "utf8")) as {
    payload: { ruleSet: WorkspaceRuleSet };
  };
  return seed.payload.ruleSet;
}

function visibleCanonicalPaths(rules: readonly EvaluatedFormFieldRule[]): readonly string[] {
  return rules.filter((rule) => rule.visible).map((rule) => rule.canonicalPath).sort();
}

describe("client-server-rules-parity (P5-B RP-05)", () => {
  it("RP-05 metadata workspace ruleSet matches package and drives same evaluateFormRules", () => {
    const form = loadGoldenForm("tour-publish-ready.json");
    (form.basicInfo as { publishStatus?: string }).publishStatus = "draft";

    const draftStep = denaliWizardSteps[0];
    assert.equal(draftStep, "denali_basic");

    const packagePlugin = getDenaliWorkspacePlugin();
    const metadataRuleSet = loadMetadataWorkspaceRuleSetFromSeed();

    assert.deepEqual(
      metadataRuleSet,
      packagePlugin.ruleSet,
      "metadata seed ruleSet must match package workspace ruleSet"
    );

    const packageEval = evaluateFormRules(form, draftStep);
    const explicitEval = evaluateFormRules(form, draftStep, { ruleSet: denaliRuleSet });

    assert.deepEqual(
      visibleCanonicalPaths(explicitEval),
      visibleCanonicalPaths(packageEval),
      "explicit denaliRuleSet must match package default on draft step 0"
    );
    assert.deepEqual(explicitEval, packageEval);

    const expected = JSON.parse(
      readFileSync(join(GOLDEN_DIR, "evaluate-form-rules.expected.json"), "utf8")
    ) as Record<string, Record<string, EvaluatedFormFieldRule[]>>;
    assert.deepEqual(packageEval, expected["tour-publish-ready"][draftStep]);
  });

  it("RP-05b package workspace ruleSet is built from exported denaliRuleSet", () => {
    const plugin = getDenaliWorkspacePlugin();
    assert.deepEqual(plugin.ruleSet, buildDenaliWorkspaceRuleSet(denaliRuleSet));
  });
});
