import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDenaliTourCreateDefaultValues,
  normalizeDenaliWizardForm,
} from "@/features/tours/wizard/schemas/denaliTourCreateSchema";

import { updateTourDtoFromDenaliWizardForm } from "./updateTourDtoFromDenaliWizardForm";

test("updateTourDtoFromDenaliWizardForm maps publishStatus to lifecycle_status", () => {
  const base = buildDenaliTourCreateDefaultValues();
  const withCapacity = {
    ...base,
    basicInfo: { ...base.basicInfo, capacityMax: 12 },
  };

  const draftDto = updateTourDtoFromDenaliWizardForm(
    normalizeDenaliWizardForm({
      ...withCapacity,
      basicInfo: { ...withCapacity.basicInfo, publishStatus: "draft" },
    }),
  );
  assert.equal(draftDto.lifecycle_status, "DRAFT");

  const activeDto = updateTourDtoFromDenaliWizardForm(
    normalizeDenaliWizardForm({
      ...withCapacity,
      basicInfo: { ...withCapacity.basicInfo, publishStatus: "active" },
    }),
  );
  assert.equal(activeDto.lifecycle_status, "OPEN");
});

test("updateTourDtoFromDenaliWizardForm sets denali_pilot formProfile by default", () => {
  const base = buildDenaliTourCreateDefaultValues();
  const dto = updateTourDtoFromDenaliWizardForm(
    normalizeDenaliWizardForm({
      ...base,
      basicInfo: { ...base.basicInfo, capacityMax: 12 },
    }),
  );
  assert.equal(dto.formProfile, "denali_pilot");
});
