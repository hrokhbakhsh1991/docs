import assert from "node:assert/strict";
import test from "node:test";

import { getTourWorkspaceDefinition } from "@repo/shared-contracts";

import { stripCreateTourDtoForFormProfile } from "@/features/tours/domain/strip-create-tour-dto-for-profile";
import { buildDenaliTourCreateTestValues } from "@/features/tours/wizard/schemas/denaliTourCreateFormModel";

import { buildDenaliWizardUploadTourPayload } from "./createDenaliWizardUploadTour";
import { denaliRuleSet } from "./rules/denaliRuleModel";
import { prepareDenaliWizardFormForSubmit } from "./validation/denaliRuleAccess";
import { mapDenaliWizardToCreateTourPayload } from "../domain/mapDenaliWizardToCreateTourPayload";

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

  const ws = getTourWorkspaceDefinition("denali_pilot")!;
  const violation = ws.validation.checkTripDetails(dto.tripDetails as never, dto.transportModes as never);
  assert.equal(violation, null);
});

test("buildDenaliWizardUploadTourPayload matches production map + strip path", () => {
  const form = buildDenaliTourCreateTestValues();
  const normalized = prepareDenaliWizardFormForSubmit(form, denaliRuleSet);
  let expected = mapDenaliWizardToCreateTourPayload(normalized);
  expected = stripCreateTourDtoForFormProfile("denali_pilot", expected);

  const dto = buildDenaliWizardUploadTourPayload({
    form,
    ruleSet: denaliRuleSet,
    workspaceFormProfile: "denali_pilot",
  });

  assert.equal(dto.lifecycle_status, "Draft");
  assert.deepEqual(
    (dto.tripDetails?.overview as { denaliTourKind?: string })?.denaliTourKind,
    (expected.tripDetails?.overview as { denaliTourKind?: string })?.denaliTourKind,
  );
});
