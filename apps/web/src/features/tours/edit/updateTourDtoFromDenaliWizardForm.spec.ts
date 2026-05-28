import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDenaliTourCreateDefaultValues,
  normalizeDenaliWizardForm,
} from "@/features/tours/wizard/schemas/denaliCore.schema";

import { updateTourDtoFromDenaliWizardForm } from "./updateTourDtoFromDenaliWizardForm";

function formWithCapacity(
  publishStatus: "draft" | "active",
  title = "Test tour title here",
) {
  const base = buildDenaliTourCreateDefaultValues();
  return normalizeDenaliWizardForm({
    ...base,
    basicInfo: {
      ...base.basicInfo,
      title,
      tourType: "mountain_day",
      capacityMax: 12,
      publishStatus,
    },
  });
}

test("updateTourDtoFromDenaliWizardForm omits lifecycle_status on save", () => {
  const dto = updateTourDtoFromDenaliWizardForm(formWithCapacity("active"), {
    patchIntent: "save",
  });
  assert.equal("lifecycle_status" in dto, false);
});

test("updateTourDtoFromDenaliWizardForm omits lifecycle_status on save even when form is active", () => {
  const dto = updateTourDtoFromDenaliWizardForm(formWithCapacity("active"));
  assert.equal("lifecycle_status" in dto, false);
});

test("updateTourDtoFromDenaliWizardForm sends OPEN only on explicit publish", () => {
  const dto = updateTourDtoFromDenaliWizardForm(formWithCapacity("draft"), {
    patchIntent: "publish",
  });
  assert.equal(dto.lifecycle_status, "OPEN");
});

test("updateTourDtoFromDenaliWizardForm does not send OPEN on save when form is draft", () => {
  const dto = updateTourDtoFromDenaliWizardForm(formWithCapacity("draft"), {
    patchIntent: "save",
  });
  assert.equal("lifecycle_status" in dto, false);
});

test("updateTourDtoFromDenaliWizardForm sets denali_pilot formProfile by default", () => {
  const dto = updateTourDtoFromDenaliWizardForm(formWithCapacity("draft"));
  assert.equal(dto.formProfile, "denali_pilot");
});
