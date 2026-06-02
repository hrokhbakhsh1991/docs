import assert from "node:assert/strict";
import test from "node:test";

import { buildDenaliTourCreateDefaultValues } from "./denaliTourCreateFormModel";
import { denaliCanonicalWizardResolver } from "./denaliWizardCanonicalResolver";

test("denaliCanonicalWizardResolver allows optional sportsInsuranceRequired false", async () => {
  const form = buildDenaliTourCreateDefaultValues();
  form.basicInfo.tourType = "mountain_day";
  form.participantRequirements.sportsInsuranceRequired = false;
  form.participantRequirements.minimumAge = 18;
  form.participantRequirements.fitnessLevel = "medium";
  form.tripDetails = {
    ...form.tripDetails,
    overview: { ...form.tripDetails.overview, peakHeight: 4000 },
  };

  const result = await denaliCanonicalWizardResolver(
    form,
    undefined,
    { criteriaMode: "all", fields: {}, names: [], shouldUseNativeValidation: false },
  );

  const insuranceError = (
    result.errors as { participantRequirements?: { sportsInsuranceRequired?: { message?: string } } } | undefined
  )?.participantRequirements?.sportsInsuranceRequired;
  assert.equal(insuranceError, undefined);
});

test("denaliCanonicalWizardResolver requires multi-day endDateTime", async () => {
  const form = buildDenaliTourCreateDefaultValues();
  form.basicInfo.tourType = "nature_multi";
  form.basicInfo.endDateTime = undefined;

  const result = await denaliCanonicalWizardResolver(
    form,
    undefined,
    { criteriaMode: "all", fields: {}, names: [], shouldUseNativeValidation: false },
  );

  assert.ok(result.errors);
  const endError = (result.errors as { basicInfo?: { endDateTime?: { message?: string } } }).basicInfo
    ?.endDateTime;
  assert.ok(endError?.message);
});

test("denaliCanonicalWizardResolver keeps values on failure", async () => {
  const form = buildDenaliTourCreateDefaultValues();
  form.transport.transportMode = "shared_cars";
  form.transport.dongAmount = undefined;

  const result = await denaliCanonicalWizardResolver(
    form,
    undefined,
    { criteriaMode: "all", fields: {}, names: [], shouldUseNativeValidation: false },
  );

  assert.equal(result.values, form);
  assert.ok(
    (result.errors as { transport?: { dongAmount?: { message?: string } } }).transport?.dongAmount
      ?.message,
  );
});
