import assert from "node:assert/strict";
import test from "node:test";

import { DenaliCanonicalTourTypeRequiredError } from "@repo/types/denali";

import { buildDenaliTourCreateDefaultValues } from "@/features/tours/wizard/schemas/denaliTourCreateFormModel";

import {
  createInitialDenaliCanonicalModel,
  denaliFormToCanonical,
  isDenaliWizardTourTypeSelected,
  safeDenaliFormToCanonical,
} from "./denaliCanonicalFormAdapter";

test("safeDenaliFormToCanonical returns initial shell when tourType is missing", () => {
  const form = buildDenaliTourCreateDefaultValues();
  assert.equal(isDenaliWizardTourTypeSelected(form), false);

  const canonical = safeDenaliFormToCanonical(form);
  assert.equal(canonical.title, "");
  assert.equal(canonical.duration, "single");
  assert.doesNotThrow(() => createInitialDenaliCanonicalModel(form));
});

test("denaliFormToCanonical throws when tourType is missing (submit strict path)", () => {
  const form = buildDenaliTourCreateDefaultValues();
  assert.throws(() => denaliFormToCanonical(form), DenaliCanonicalTourTypeRequiredError);
});

test("safeDenaliFormToCanonical maps strictly after tourType is selected", () => {
  const form = buildDenaliTourCreateDefaultValues();
  form.basicInfo.tourType = "mountain_day";
  form.basicInfo.title = "Test tour title here";

  const safe = safeDenaliFormToCanonical(form);
  const strict = denaliFormToCanonical(form);
  assert.equal(safe.category, strict.category);
  assert.equal(safe.duration, strict.duration);
  assert.equal(safe.title, strict.title);
});
