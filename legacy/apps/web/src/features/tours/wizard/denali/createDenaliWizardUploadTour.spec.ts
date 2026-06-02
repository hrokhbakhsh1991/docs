import assert from "node:assert/strict";
import test from "node:test";

import { stripCreateTourDtoForFormProfile } from "@/features/tours/domain/strip-create-tour-dto-for-profile";
import {
  buildDenaliTourCreateDefaultValues,
  buildDenaliTourCreateTestValues,
} from "@/features/tours/wizard/schemas/denaliTourCreateFormModel";

import { buildDenaliWizardUploadTourPayload } from "./createDenaliWizardUploadTour";
import { denaliRuleSet } from "./rules/denaliRuleModel";
import { buildDenaliStagingShellProjection } from "../domain/buildDenaliCreateTourPayloadProjection";
import { mapDenaliCreateTourPayloadProjectionToDto } from "../domain/mapDenaliWizardToCreateTourPayload";

test("buildDenaliWizardUploadTourPayload includes overview.denaliTourKind like production submit", () => {
  const form = buildDenaliTourCreateTestValues();
  const dto = buildDenaliWizardUploadTourPayload({
    form,
    ruleSet: denaliRuleSet,
    workspaceFormProfile: "denali_pilot",
  });

  const overview = dto.tripDetails?.overview as { denaliTourKind?: string } | undefined;
  assert.equal(overview?.denaliTourKind, "mountain_day");
  assert.equal(dto.lifecycle_status, "Draft");
  assert.equal(dto.metadata?.vertical, "staging_shell");
  assert.equal(dto.metadata?.isStagingShell, true);
  assert.equal(dto.price, 0);
});

test("buildDenaliWizardUploadTourPayload succeeds on fresh form without capacityMax", () => {
  const form = buildDenaliTourCreateDefaultValues();
  assert.equal(form.basicInfo.capacityMax, undefined);

  assert.doesNotThrow(() =>
    buildDenaliWizardUploadTourPayload({
      form,
      ruleSet: denaliRuleSet,
      workspaceFormProfile: "denali_pilot",
    }),
  );

  const dto = buildDenaliWizardUploadTourPayload({
    form,
    ruleSet: denaliRuleSet,
    workspaceFormProfile: "denali_pilot",
  });

  assert.equal(dto.capacity, 1);
  assert.equal(dto.price, 0);
  assert.equal(dto.title, "پیش‌نویس — در حال تکمیل ویزارد");
  assert.equal(dto.metadata?.isStagingShell, true);
});

test("buildDenaliWizardUploadTourPayload uses staging projection + profile strip", () => {
  const form = buildDenaliTourCreateTestValues();
  let expected = mapDenaliCreateTourPayloadProjectionToDto(buildDenaliStagingShellProjection(form));
  expected = stripCreateTourDtoForFormProfile("denali_pilot", expected);

  const dto = buildDenaliWizardUploadTourPayload({
    form,
    ruleSet: denaliRuleSet,
    workspaceFormProfile: "denali_pilot",
  });

  assert.equal(dto.lifecycle_status, "Draft");
  assert.equal(dto.price, 0);
  assert.deepEqual(
    (dto.tripDetails?.overview as { denaliTourKind?: string })?.denaliTourKind,
    (expected.tripDetails?.overview as { denaliTourKind?: string })?.denaliTourKind,
  );
});
