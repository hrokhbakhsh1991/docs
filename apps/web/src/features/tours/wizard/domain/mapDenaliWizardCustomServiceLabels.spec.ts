import assert from "node:assert/strict";
import test from "node:test";

import { buildDenaliTourCreateTestValues } from "@/features/tours/wizard/schemas/denaliTourCreateSchema";
import { submitValidDenaliWizardDefaults } from "@/features/tours/wizard/denali/validation/denaliSubmitTestHelpers";
import { buildCreateTourPostBody } from "@/lib/services/tours.service";
import { mapCreateTourDto } from "@/features/tours/domain/mapCreateTourDto";

import { mapDenaliWizardToCreateTourPayload } from "./mapDenaliWizardToCreateTourPayload";

test("mapDenaliWizardToCreateTourPayload includes customServiceLabels from form state", () => {
  const form = submitValidDenaliWizardDefaults();
  form.tripDetails = {
    ...form.tripDetails,
    overview: {
      customServiceLabels: ["صبحانه", "نیسان"],
    },
  };

  const dto = mapDenaliWizardToCreateTourPayload(form);
  assert.deepEqual(dto.customServiceLabels, ["صبحانه", "نیسان"]);

  const wire = buildCreateTourPostBody(mapCreateTourDto({ ...dto }));
  assert.deepEqual(wire.customServiceLabels, ["صبحانه", "نیسان"]);
});

test("mapDenaliWizardToCreateTourPayload omits customServiceLabels when empty", () => {
  const form = buildDenaliTourCreateTestValues();
  const dto = mapDenaliWizardToCreateTourPayload(form);
  assert.equal(dto.customServiceLabels, undefined);
});
