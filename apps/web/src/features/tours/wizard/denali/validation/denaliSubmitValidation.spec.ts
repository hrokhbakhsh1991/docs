import assert from "node:assert/strict";
import test from "node:test";

import { buildDenaliTourCreateTestValues } from "@/features/tours/wizard/schemas/denaliTourCreateFormModel";

import { parseDenaliCanonicalFromWizardForm } from "./denaliSubmitValidation";

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
    (err: unknown) => {
      assert.equal((err as { name?: string }).name, "ZodError");
      return true;
    },
  );
});
