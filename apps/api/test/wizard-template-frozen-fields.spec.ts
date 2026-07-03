import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertDenaliFrozenWizardTemplateFieldsPresent,
  DENALI_SMOKE_TENANT_ID,
  normalizeDenaliWizardTemplatePayloadSteps,
} from "@app-tour/workspace-denali";
import { URBAN_SMOKE_TENANT_ID } from "@app-tour/workspace-urban";

import {
  assertDenaliWizardTemplateFrozenFieldsForTenant,
  normalizeDenaliWizardTemplatePayloadForTenant,
  SettingsWizardFrozenFieldMissingError,
} from "../src/settings/wizard-template-catalog";

describe("wizard-template-frozen-fields.spec.ts", () => {
  it("API-WIZ-FRZ-01 normalizeDenaliWizardTemplatePayloadForTenant injects frozen for denali", () => {
    const normalized = normalizeDenaliWizardTemplatePayloadForTenant("denali", {
      published: true,
      steps: [{ stepId: "denali_basic", enabled: true, fields: [{ canonicalPath: "title" }] }],
    });
    assert.ok(
      normalized.steps?.some((step) =>
        step.fields.some((field) => field.canonicalPath === "category")
      )
    );
  });

  it("API-WIZ-FRZ-02 assertDenaliWizardTemplateFrozenFieldsForTenant rejects missing frozen field", async () => {
    await assert.rejects(
      () =>
        assertDenaliWizardTemplateFrozenFieldsForTenant(DENALI_SMOKE_TENANT_ID, {
          published: true,
          steps: [{ stepId: "denali_basic", enabled: true, fields: [{ canonicalPath: "title" }] }],
        }),
      SettingsWizardFrozenFieldMissingError
    );
  });

  it("API-WIZ-FRZ-03 starter workspace skips frozen assert", async () => {
    await assert.doesNotReject(() =>
      assertDenaliWizardTemplateFrozenFieldsForTenant(URBAN_SMOKE_TENANT_ID, {
        published: true,
        steps: [{ stepId: "basics", enabled: true, fields: [{ canonicalPath: "basics.title" }] }],
      })
    );
  });

  it("API-WIZ-FRZ-04 workspace-denali assert helper throws on stripped payload", () => {
    assert.throws(
      () =>
        assertDenaliFrozenWizardTemplateFieldsPresent({
          published: true,
          steps: [{ stepId: "denali_basic", enabled: true, fields: [{ canonicalPath: "title" }] }],
        }),
      (error: unknown) =>
        error instanceof Error && error.message.includes("SETTINGS_WIZARD_FROZEN_FIELD_MISSING")
    );
  });

  it("API-WIZ-FRZ-05 normalize payload steps is no-op when unpublished", () => {
    const payload = { published: false, steps: [] };
    assert.deepEqual(normalizeDenaliWizardTemplatePayloadSteps(payload), payload);
  });
});
