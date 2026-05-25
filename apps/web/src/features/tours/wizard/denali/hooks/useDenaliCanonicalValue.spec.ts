import assert from "node:assert/strict";
import test from "node:test";

import type { DenaliCanonicalTourModel } from "@repo/types/denali";

import { denaliFormToCanonical } from "../denaliCanonicalFormAdapter";
import {
  getDenaliCanonicalPathValue,
  isKnownDenaliCanonicalPath,
} from "../denaliCanonicalPathUtils";
import { applyDenaliStructuralInvariants } from "../validation/denaliInvariantEngine";
import {
  clearDenaliNonVisibleFormValues,
  resolveDenaliRuleModelFromForm,
} from "../validation/denaliRuleAccess";
import { buildDenaliTourCreateTestValues } from "@/features/tours/wizard/schemas/denaliTourCreateFormModel";

function buildMinimalCanonicalFixture(): DenaliCanonicalTourModel {
  const form = buildDenaliTourCreateTestValues();
  form.basicInfo.title = "Test tour";
  form.transport.transportMode = "none";
  form.transport.transportCost = 42_000;
  form.programNature.themeIds = ["theme-a"];
  form.programNature.shortDescription = "Short";
  return denaliFormToCanonical(form);
}

const minimalCanonical = buildMinimalCanonicalFixture();

test("isKnownDenaliCanonicalPath accepts registry leaves and section roots", () => {
  assert.equal(isKnownDenaliCanonicalPath("title"), true);
  assert.equal(isKnownDenaliCanonicalPath("program.themeIds"), true);
  assert.equal(isKnownDenaliCanonicalPath("transport.mode"), true);
  assert.equal(isKnownDenaliCanonicalPath("participants.minRequiredPeaks"), true);
  for (const section of [
    "program",
    "transport",
    "pricing",
    "participants",
    "policies",
  ] as const) {
    assert.equal(isKnownDenaliCanonicalPath(section), true, section);
  }
  assert.equal(isKnownDenaliCanonicalPath("progam.themeIds"), false);
  assert.equal(isKnownDenaliCanonicalPath("not.a.real.path"), false);
});

test("getDenaliCanonicalPathValue reads nested registry paths", () => {
  assert.equal(getDenaliCanonicalPathValue(minimalCanonical, "title"), "Test tour");
  assert.equal(getDenaliCanonicalPathValue(minimalCanonical, "transport.mode"), "none");
  assert.equal(getDenaliCanonicalPathValue(minimalCanonical, "transport.transportCost"), 42_000);
  assert.deepEqual(getDenaliCanonicalPathValue(minimalCanonical, "program.themeIds"), ["theme-a"]);
  assert.equal(
    (getDenaliCanonicalPathValue(minimalCanonical, "program") as { shortDescription?: string })
      ?.shortDescription,
    "Short",
  );
  assert.equal(getDenaliCanonicalPathValue(minimalCanonical, "missing.path"), undefined);
});

test("getDenaliCanonicalPathValue: mountain + mode none clears ghost transportCost on canonical", () => {
  const form = buildDenaliTourCreateTestValues();
  form.basicInfo.tourType = "mountain_day";
  form.transport.transportMode = "none";
  form.transport.transportCost = 99_000;

  const model = resolveDenaliRuleModelFromForm(form);
  assert.ok(model);

  const afterStructural = applyDenaliStructuralInvariants(form);
  const cleared = clearDenaliNonVisibleFormValues(afterStructural, model);
  const canonical = denaliFormToCanonical(cleared);

  assert.equal(
    getDenaliCanonicalPathValue(canonical, "transport.transportCost"),
    undefined,
    "canonical read path must not surface hidden transportCost",
  );
  assert.equal(getDenaliCanonicalPathValue(canonical, "transport.mode"), "none");
});
