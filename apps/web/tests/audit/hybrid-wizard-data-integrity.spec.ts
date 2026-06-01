/**
 * QA stress probes: Hybrid Wizard / Manual Mode data-integrity paths.
 * @see reports/hybrid-wizard-data-integrity-audit.md
 */
import assert from "node:assert/strict";
import test from "node:test";

import { buildDenaliTourCreateDefaultValues } from "@/features/tours/wizard/schemas/denaliCore.schema";
import { isWizardFormCanonicalEmpty } from "@/features/tours/wizard/validation/wizardCanonicalSubmitGuard";
import { evaluateDenaliWizardSubmitGate } from "@/features/tours/wizard/denali/validation/denaliSubmitValidation";
import {
  buildDenaliSubmitPayloadProjection,
  pruneDenaliWizardFormForSubmit,
} from "@/features/tours/wizard/domain/buildDenaliCreateTourPayloadProjection";
import { denaliCanonicalFromForm } from "@repo/types/denali";
import { isDenaliCanonicalTemplateDataEmpty, validateDenaliCanonicalTemplateData } from "@repo/types/denali";
import { packTemplateCanonicalForPersist } from "@/lib/validation/tour-wizard-template-builder-form";

test("ghost submission: zero fields blocks canonical empty guard", () => {
  const form = buildDenaliTourCreateDefaultValues();
  assert.equal(isWizardFormCanonicalEmpty(form), true);
  assert.equal(evaluateDenaliWizardSubmitGate(form).success, true);
});

test("ghost submission: tourType-only passes empty guard (draft gate also passes)", () => {
  const form = buildDenaliTourCreateDefaultValues();
  form.basicInfo.tourType = "mountain_single_day";
  assert.equal(isWizardFormCanonicalEmpty(form), false);
  assert.equal(evaluateDenaliWizardSubmitGate(form).success, true);
});

test("ghost submission: tourType-only submit projection throws before API", () => {
  const form = buildDenaliTourCreateDefaultValues();
  form.basicInfo.tourType = "mountain_single_day";
  const pruned = pruneDenaliWizardFormForSubmit(form);
  assert.throws(() => buildDenaliSubmitPayloadProjection(pruned));
});

test("classification leak: template API accepts category without duration", () => {
  const result = validateDenaliCanonicalTemplateData({ category: "mountain", title: "Partial" });
  assert.equal(result.ok, true);
  const packed = packTemplateCanonicalForPersist(null, { category: "mountain", title: "Partial" });
  assert.equal(packed.category, "mountain");
  assert.equal(packed.duration, undefined);
  assert.equal(isDenaliCanonicalTemplateDataEmpty(packed), false);
});

test("classification leak: tourType-only canonical is non-empty by key presence", () => {
  const form = buildDenaliTourCreateDefaultValues();
  form.basicInfo.tourType = "mountain_single_day";
  const canonical = denaliCanonicalFromForm(form);
  assert.equal(isDenaliCanonicalTemplateDataEmpty(canonical), false);
  assert.equal(canonical.title.trim(), "");
});
