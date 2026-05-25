import assert from "node:assert/strict";
import test from "node:test";

import { DataLegacyError, DATA_LEGACY_PROFILE_MISMATCH_MESSAGE } from "./data-legacy-error";
import { StrictProfileValidator } from "./strict-profile-validator";
import type { TenantWizardTemplate } from "@/features/tours/wizard/template/tenant-wizard-template.types";

function templateRow(
  partial: Partial<TenantWizardTemplate> & Pick<TenantWizardTemplate, "baseProfile">,
): TenantWizardTemplate {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    workspaceId: "22222222-2222-4222-8222-222222222222",
    stepOverrides: { skip: [], insert: [] },
    fieldRulesOverlay: {},
    presetId: null,
    canonicalData: {},
    wizardContractVersion: 1,
    formProfileVersion: 1,
    ...partial,
  };
}

test("StrictProfileValidator throws DataLegacyError for Denali canonical + general profile", () => {
  assert.throws(
    () =>
      StrictProfileValidator.validate({
        template: templateRow({
          baseProfile: "general",
          canonicalData: { title: "Mismatch", category: "mountain" },
        }),
        resolvedProfile: "general",
      }),
    (error: unknown) => {
      assert.ok(error instanceof DataLegacyError);
      assert.equal(error.message, DATA_LEGACY_PROFILE_MISMATCH_MESSAGE);
      return true;
    },
  );
});

test("StrictProfileValidator passes for urban_event Denali rail profile", () => {
  assert.doesNotThrow(() =>
    StrictProfileValidator.validate({
      template: templateRow({ baseProfile: "urban_event" }),
      resolvedProfile: "urban_event",
    }),
  );
});
