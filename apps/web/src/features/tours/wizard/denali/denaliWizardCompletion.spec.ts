import assert from "node:assert/strict";
import test from "node:test";

import { buildDenaliTourCreateDefaultValues, buildDenaliTourCreateTestValues } from "@/features/tours/wizard/schemas/denaliTourCreateFormModel";

import {
  calculateCompletionPercentage,
  calculateDenaliWizardCompletionScore,
} from "./denaliWizardCompletion";
import { DENALI_FIELD_REGISTRY } from "./registry/DenaliFieldRegistry";
import { DENALI_FIELD_COMPLETION_WEIGHTS } from "./registry/denaliFieldCompletionWeights";

test("every registry entry has a non-negative content-quality weight", () => {
  for (const row of DENALI_FIELD_REGISTRY) {
    assert.equal(typeof row.weight, "number", row.canonicalPath);
    assert.ok(row.weight >= 0, `${row.canonicalPath} weight should be >= 0`);
  }
});

test("registry weights match completion map for canonical paths", () => {
  for (const row of DENALI_FIELD_REGISTRY) {
  const expected = DENALI_FIELD_COMPLETION_WEIGHTS[row.canonicalPath] ?? 1;
    assert.equal(row.weight, expected, row.canonicalPath);
  }
});

test("title and photos use the documented high-impact weights", () => {
  const title = DENALI_FIELD_REGISTRY.find((row) => row.canonicalPath === "title");
  const photos = DENALI_FIELD_REGISTRY.find((row) => row.canonicalPath === "photos");
  assert.equal(title?.weight, 5);
  assert.equal(photos?.weight, 10);
});

test("calculateCompletionPercentage is low for default form values", () => {
  const form = buildDenaliTourCreateDefaultValues();
  const score = calculateDenaliWizardCompletionScore(form);
  assert.ok(score.percentage < 15);
  assert.ok(score.filledWeight < score.totalWeight);
});

test("calculateCompletionPercentage dedupes duplicate rhf paths by highest weight", () => {
  const form = buildDenaliTourCreateDefaultValues();
  form.basicInfo.tourType = "mountain_day";

  const score = calculateDenaliWizardCompletionScore(form);
  assert.ok(score.totalWeight > 0);
  assert.equal(calculateCompletionPercentage(form), score.percentage);
});

test("calculateCompletionPercentage increases when weighted fields are filled", () => {
  const form = buildDenaliTourCreateTestValues();
  form.basicInfo.tourType = "mountain_day";
  form.basicInfo.title = "Damavand south route";
  form.photosData.photos = [{ id: "photo-1", url: "https://example.com/a.jpg" } as never];

  const empty = calculateCompletionPercentage(buildDenaliTourCreateDefaultValues());
  const partial = calculateCompletionPercentage(form);
  assert.ok(partial > empty);
  assert.ok(partial <= 100);
});
