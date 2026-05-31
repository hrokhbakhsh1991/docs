import assert from "node:assert/strict";
import test from "node:test";

import { buildDenaliTourCreateDefaultValues } from "@/features/tours/wizard/schemas/denaliTourCreateFormModel";
import {
  getDenaliWizardSubmitIssues,
  validateDenaliWizardForm,
} from "@/features/tours/wizard/denali/validation/denaliWizardFormZod";
import { safeParseDenaliCanonicalFromWizardForm } from "@/features/tours/wizard/denali/validation/denaliSubmitValidation";
import {
  buildDenaliCreateTourPayloadProjection,
  buildDenaliStagingShellProjection,
} from "@/features/tours/wizard/domain/buildDenaliCreateTourPayloadProjection";

test("validateDenaliWizardForm rejects capacityMax zero", () => {
  const form = buildDenaliTourCreateDefaultValues();
  form.basicInfo.capacityMax = 0;
  const result = validateDenaliWizardForm(form);
  assert.equal(result.success, false);
  assert.ok(result.issues.some((i) => i.path.join(".") === "basicInfo.capacityMax"));
});

test("validateDenaliWizardForm rejects dongAmount zero when shared_cars", () => {
  const form = buildDenaliTourCreateDefaultValues();
  form.transport.transportMode = "shared_cars";
  form.transport.dongAmount = 0;
  const result = validateDenaliWizardForm(form);
  assert.equal(result.success, false);
  assert.ok(result.issues.some((i) => i.path.join(".") === "transport.dongAmount"));
});

test("validateDenaliWizardForm rejects basePricePerPerson zero when paid", () => {
  const form = buildDenaliTourCreateDefaultValues();
  form.pricingPayment.requiresPayment = true;
  form.pricingPayment.basePricePerPerson = 0;
  const result = validateDenaliWizardForm(form);
  assert.equal(result.success, false);
  assert.ok(
    result.issues.some((i) => i.path.join(".") === "pricingPayment.basePricePerPerson"),
  );
});

test("canonical parse rejects missing capacityMax after adapter passthrough", () => {
  const form = buildDenaliTourCreateDefaultValues();
  form.basicInfo.tourType = "mountain_day";
  form.basicInfo.startDateTime = "2026-06-03T18:00:00.000Z";
  form.basicInfo.capacityMax = undefined;
  const parsed = safeParseDenaliCanonicalFromWizardForm(form);
  assert.equal(parsed.success, false);
  assert.ok(
    parsed.success === false &&
      parsed.error.issues.some((i) => canonicalIssueTouchesCapacity(i.path)),
  );
});

/** Projection layer only — submit gate would block dong/capacity zero before map in production. */
test("buildDenaliCreateTourPayloadProjection omits fuelShareToman when dong is zero", () => {
  const form = buildDenaliTourCreateDefaultValues();
  form.basicInfo.tourType = "mountain_day";
  form.basicInfo.startDateTime = "2026-06-03T18:00:00.000Z";
  form.basicInfo.capacityMax = 10;
  form.transport.transportMode = "shared_cars";
  form.transport.dongAmount = 0;
  const dto = buildDenaliCreateTourPayloadProjection(form);
  assert.equal(dto.tripDetails?.logistics?.fuelShareToman, undefined);
});

test("buildDenaliCreateTourPayloadProjection throws when capacityMax is not positive", () => {
  const form = buildDenaliTourCreateDefaultValues();
  form.basicInfo.tourType = "mountain_day";
  form.basicInfo.startDateTime = "2026-06-03T18:00:00.000Z";
  form.basicInfo.capacityMax = 0;
  assert.throws(
    () => buildDenaliCreateTourPayloadProjection(form),
    /capacityMax must be a positive integer/,
  );
});

test("buildDenaliStagingShellProjection accepts missing capacityMax with placeholder capacity", () => {
  const form = buildDenaliTourCreateDefaultValues();
  const dto = buildDenaliStagingShellProjection(form);
  assert.equal(dto.capacity, 1);
  assert.equal(dto.price, 0);
});

function canonicalIssueTouchesCapacity(path: PropertyKey[]): boolean {
  const joined = path.map(String).join(".");
  return joined === "capacityMax" || joined.endsWith("capacityMax");
}

test("getDenaliWizardSubmitIssues rejects cleared capacity (undefined)", () => {
  const form = buildDenaliTourCreateDefaultValues();
  form.basicInfo.capacityMax = undefined;
  const issues = getDenaliWizardSubmitIssues(form);
  assert.ok(issues.some((i) => i.path.join(".") === "basicInfo.capacityMax"));
});
