import assert from "node:assert/strict";
import test from "node:test";

import { buildDenaliTourCreateTestValues } from "@/features/tours/wizard/schemas/denaliTourCreateFormModel";

import { ValidationError } from "zod-validation-error";

import { parseDenaliCanonicalFromWizardForm } from "./denaliSubmitValidation";
import { submitValidDenaliWizardDefaults } from "@/features/tours/testing/denaliSubmitTestHelpers";

test("parseDenaliCanonicalFromWizardForm accepts default mountain_day form", () => {
  const canonical = parseDenaliCanonicalFromWizardForm(buildDenaliTourCreateTestValues());
  assert.equal(canonical.category, "mountain");
  assert.equal(canonical.duration, "single");
});

test("parseDenaliCanonicalFromWizardForm throws on invalid title", () => {
  const form = buildDenaliTourCreateTestValues();
  form.basicInfo.title = "short";
  assert.throws(
    () => parseDenaliCanonicalFromWizardForm(form),
    (err: unknown) => err instanceof ValidationError,
  );
});

test("submitValidDenaliWizardDefaults is step-order agnostic and includes photos-step content", () => {
  const form = submitValidDenaliWizardDefaults();
  assert.ok(
    (form.programNature.shortDescription ?? "").trim().length > 0,
    "default submit fixture must include shortDescription (denali_photos required field)",
  );
  assert.equal(parseDenaliCanonicalFromWizardForm(form).program?.shortDescription, form.programNature.shortDescription);
});
